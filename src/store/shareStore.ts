/**
 * 같이 고르기 화면 상태. 호스트(share/host.ts)든 참여자(share/client.ts)든 여기서는
 * 똑같이 `room`(방 상태)과 `act()`(요청 보내기)만 쓰면 되게 감싼다.
 */
import { create } from 'zustand';

import { joinRoom, type ClientConn } from '../share/client';
import { createHostRoom, type HostRoom } from '../share/host';
import { type Action, cleanName, type RoomState } from '../share/protocol';
import { clientTransport, type HostInfo, hostTransport } from '../share/transport';
import { useSettings } from './settingsStore';
import { toast } from './uiStore';

export type ShareRole = 'none' | 'host' | 'client';
export type ShareStatus = 'idle' | 'starting' | 'hosting' | 'connecting' | 'connected' | 'reconnecting';

const BYE_FLUSH_MS = 180;
const RECENT_MAX = 4;

type ShareStore = {
  role: ShareRole;
  status: ShareStatus;
  /** 설정 화면에 보여줄 마지막 오류 */
  error: string;
  info: HostInfo | null;
  target: { host: string; port: number } | null;
  myId: string;
  room: RoomState | null;
  panelOpen: boolean;
  unread: number;
  /** 세션이 끝난 이유 (호스트 종료·내보냄·연결 끊김). 확인하면 지운다. */
  ended: string | null;

  startHost: () => Promise<boolean>;
  stopHost: () => Promise<void>;
  join: (host: string, port: number) => Promise<boolean>;
  cancelJoin: () => void;
  leave: () => void;
  act: (a: Action) => void;
  kick: (memberId: string) => void;
  openPanel: () => void;
  closePanel: () => void;
  dismissEnded: () => void;
  clearError: () => void;
};

let hostRoom: HostRoom | null = null;
let conn: ClientConn | null = null;
let joinToken = 0;
let lastSeenChat = '';
/** 참여자가 처음 들어왔을 때 호스트 화면에 패널을 한 번만 자동으로 띄운다. */
let autoOpened = false;

const errText = (e: unknown) => (typeof e === 'string' ? e : e instanceof Error ? e.message : String(e));

const unreadOf = (room: RoomState, me: string) => {
  const i = room.chat.findIndex((m) => m.id === lastSeenChat);
  return room.chat.slice(i + 1).filter((m) => m.kind === 'chat' && m.from !== me).length;
};

const markSeen = (room: RoomState | null) => {
  const last = room?.chat[room.chat.length - 1];
  lastSeenChat = last ? last.id : '';
};

const profile = () => {
  const s = useSettings.getState();
  return { id: s.shareId, name: cleanName(s.name) || '손님', hue: s.hue };
};

export const parsePort = (raw: string) => {
  const n = Number(String(raw).trim());
  return Number.isInteger(n) && n >= 1024 && n <= 65535 ? n : null;
};

export const useShare = create<ShareStore>((set, get) => {
  const setRoom = (room: RoomState, myId: string) => {
    if (get().panelOpen) markSeen(room);
    set({ room, myId, unread: get().panelOpen ? 0 : unreadOf(room, myId) });
  };

  const reset = (p: Partial<ShareStore> = {}) =>
    set({
      role: 'none',
      status: 'idle',
      info: null,
      room: null,
      panelOpen: false,
      unread: 0,
      ...p,
    });

  return {
    role: 'none',
    status: 'idle',
    error: '',
    info: null,
    target: null,
    myId: '',
    room: null,
    panelOpen: false,
    unread: 0,
    ended: null,

    startHost: async () => {
      if (get().role !== 'none') return false;
      const port = parsePort(useSettings.getState().port);
      if (port === null) {
        set({ error: '포트는 1024 ~ 65535 사이의 숫자로 정해 주세요.' });
        return false;
      }
      set({ role: 'host', status: 'starting', error: '', ended: null });
      autoOpened = false;
      lastSeenChat = '';
      const room = createHostRoom({
        onState: (s) => setRoom(s, s.hostId),
        onGuestJoined: (m) => {
          toast(`${m.name}님이 같이 고르기에 들어왔어요`);
          if (!autoOpened && !get().panelOpen) {
            autoOpened = true;
            get().openPanel();
          }
        },
        onError: (msg) => toast(msg),
      });
      try {
        const info = await hostTransport.start(port, room.handle);
        hostRoom = room;
        set({ status: 'hosting', info, myId: room.getState().hostId });
        return true;
      } catch (e) {
        room.dispose('');
        reset({ error: errText(e) });
        return false;
      }
    },

    stopHost: async () => {
      const room = hostRoom;
      hostRoom = null;
      if (room) {
        room.dispose('호스트가 같이 고르기를 끝냈어요.');
        // 작별 인사가 나갈 틈을 준다.
        await new Promise((r) => setTimeout(r, BYE_FLUSH_MS));
      }
      await hostTransport.stop();
      reset();
    },

    join: async (rawHost, port) => {
      if (get().role === 'host') return false;
      const host = rawHost.trim();
      if (!host) {
        set({ error: '호스트 주소를 입력해 주세요.' });
        return false;
      }
      conn?.close();
      conn = null;
      const token = ++joinToken;
      lastSeenChat = '';
      set({
        role: 'client',
        status: 'connecting',
        error: '',
        target: { host, port },
        ended: null,
        room: null,
      });
      try {
        const c = await joinRoom(host, port, profile, {
          onState: (s, you) => {
            if (token === joinToken) setRoom(s, you);
          },
          onStatus: (status) => {
            if (token === joinToken) set({ status });
          },
          onError: (msg) => {
            if (token === joinToken) toast(msg);
          },
          onEnd: (reason) => {
            if (token !== joinToken) return;
            conn = null;
            reset({ ended: reason });
          },
        });
        if (token !== joinToken) {
          c.close();
          return false;
        }
        conn = c;
        const st = useSettings.getState();
        const key = `${host}:${port}`;
        st.patch({
          joinHost: host,
          joinPort: String(port),
          recentHosts: [key, ...st.recentHosts.filter((h) => h !== key)].slice(0, RECENT_MAX),
        });
        get().openPanel();
        return true;
      } catch (e) {
        if (token === joinToken) reset({ error: errText(e) });
        return false;
      }
    },

    cancelJoin: () => {
      joinToken += 1;
      conn?.close();
      conn = null;
      clientTransport.disconnect();
      reset();
    },

    leave: () => {
      joinToken += 1;
      conn?.close();
      conn = null;
      reset();
    },

    act: (a) => {
      const { role, myId } = get();
      if (role === 'host' && hostRoom) hostRoom.act(myId, a);
      else if (role === 'client' && conn) conn.send(a);
    },

    kick: (memberId) => hostRoom?.kick(memberId),

    openPanel: () => {
      markSeen(get().room);
      set({ panelOpen: true, unread: 0 });
    },

    closePanel: () => set({ panelOpen: false }),
    dismissEnded: () => set({ ended: null }),
    clearError: () => set({ error: '' }),
  };
});

// 참여 중에 이름·색을 바꾸면 호스트에 알린다 (호스트 자신은 host.ts 가 설정을 구독한다).
let profileTimer: ReturnType<typeof setTimeout> | undefined;
useSettings.subscribe((s, prev) => {
  if (s.name === prev.name && s.hue === prev.hue) return;
  if (useShare.getState().role !== 'client') return;
  clearTimeout(profileTimer);
  profileTimer = setTimeout(() => {
    const p = profile();
    useShare.getState().act({ type: 'profile', name: p.name, hue: p.hue });
  }, 500);
});

/** 앱을 켤 때: '자동 시작' 이 켜져 있으면 공유 서버를 연다. */
export async function bootShare() {
  const s = useSettings.getState();
  if (!s.autoStart) return;
  const ok = await useShare.getState().startHost();
  if (!ok) toast(`공유 서버를 자동으로 열지 못했어요: ${useShare.getState().error}`);
}

/** 창을 닫기 전에: 참여자들에게 작별 인사를 보내고 연결을 정리한다. */
export async function shutdownShare() {
  const st = useShare.getState();
  if (st.role === 'host') await st.stopHost();
  else if (st.role === 'client') st.leave();
}

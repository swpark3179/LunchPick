/**
 * 같이 고르기 화면 상태. 호스트(share/host.ts)든 참여자(share/client.ts)든 여기서는
 * 똑같이 `room`(방 상태)과 `act()`(요청 보내기)만 쓰면 되게 감싼다.
 *
 * 서버 켜기·접속은 실제로는 금방 끝나지만, 시안처럼 단계(포트 확인 → 서버 시작 → 공유 준비 /
 * 호스트 찾기 → 연결 확인 → 식당 정보 받기 → 입장 준비)를 하나씩 보여준다. 각 단계는 실제
 * 진행을 기다리고, 너무 빨리 끝나면 최소 시간만큼 머문다.
 */
import { create } from 'zustand';

import { mergeRestaurants, nameKey } from '../lib/shareFormat';
import type { RecentHost } from '../lib/types';
import { joinRoom, type ClientConn } from '../share/client';
import { createHostRoom, type HostRoom } from '../share/host';
import {
  type Action,
  cleanName,
  type FocusMap,
  hashHue,
  type Removed,
  type RoomState,
  shortName,
} from '../share/protocol';
import { clientTransport, type HostInfo, hostTransport } from '../share/transport';
import { useData } from './dataStore';
import { useSettings } from './settingsStore';
import { toast, useUi } from './uiStore';

export type ShareRole = 'none' | 'host' | 'client';
export type ShareStatus = 'idle' | 'starting' | 'hosting' | 'connecting' | 'connected' | 'reconnecting';
export type ErrField = 'port' | 'addr' | null;

const BYE_FLUSH_MS = 180;
const RECENT_MAX = 4;
const FOCUS_SEND_MS = 160;
/** 접속이 끝나고 같이 고르기 화면으로 넘어가기까지 (시안: '곧 이동해요') */
const AUTO_ENTER_MS = 1100;

/** 단계별 최소 머무는 시간 */
const HOST_STEP_MS = [650, 650, 600];
const CLIENT_STEP_MS = [800, 700, 0, 550];
const SYNC_TICK_MS = 38;

type ShareStore = {
  role: ShareRole;
  status: ShareStatus;
  /** 서버 켜기·접속 단계 (진행 중인 단계의 번호) */
  step: number;
  /** 접속 중 '식당 정보 받는 중 k/N' 의 k */
  sync: number;
  error: string;
  errField: ErrField;
  /** 오류가 날 때마다 바뀐다 — 입력칸을 흔드는 애니메이션을 다시 재생한다 */
  errKey: number;
  info: HostInfo | null;
  target: { host: string; port: number } | null;
  myId: string;
  room: RoomState | null;
  focus: FocusMap;
  unread: number;
  /** 세션이 끝난 이유 (호스트 종료·내보냄·연결 끊김). 확인하면 지운다. */
  ended: string | null;

  startHost: () => Promise<boolean>;
  stopHost: () => Promise<void>;
  join: (addr: string) => Promise<boolean>;
  cancelJoin: () => void;
  leave: () => void;
  act: (a: Action) => void;
  /** 내가 보고 있는 카드 — 다른 사람 화면에 이름표로 보인다 */
  sendFocus: (restId: string | null) => void;
  kick: (memberId: string) => void;
  /** 식당 정보 동기화를 요청한다 — 참여자면 내 식당 목록을 함께 보낸다 */
  startSync: () => void;
  /** 지금 열린 동기화 요청에 답한다 */
  answerSync: (accept: boolean) => void;
  enterRoom: () => void;
  dismissEnded: () => void;
  clearError: () => void;
};

let hostRoom: HostRoom | null = null;
let conn: ClientConn | null = null;
/** 시작·접속을 다시 누르거나 취소하면 바뀐다 — 늦게 끝난 이전 시도를 버린다 */
let token = 0;
let lastSeenChat = '';
let focusSent: string | null = null;
let focusWant: string | null = null;
let focusTimer: ReturnType<typeof setTimeout> | undefined;

const errText = (e: unknown) => (typeof e === 'string' ? e : e instanceof Error ? e.message : String(e));
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** since 부터 ms 가 지날 때까지 기다린다 */
const atLeast = async (since: number, ms: number) => {
  const w = since + ms - Date.now();
  if (w > 0) await delay(w);
};

const inRoom = () => useUi.getState().view === 'together';

// ---------------------------------------------------------------- 방에서 일어난 일을 내 목록에 반영

/** 이번 세션(서버 켜기·접속 한 번)에서 이미 처리한 것들 — 재접속해도 이어진다 */
let effectsReady = false;
const seenRemoved = new Set<string>();
const seenAsk = new Set<string>();
const seenSyncEnd = new Set<string>();

const resetEffects = () => {
  effectsReady = false;
  seenRemoved.clear();
  seenAsk.clear();
  seenSyncEnd.clear();
};

const removedKey = (r: Removed) => `${r.id}:${r.at}`;

/**
 * 방 상태가 올 때마다: 동기화 요청 알림, 그리고 참여자라면 지운 식당·끝난 동기화를 내 식당
 * 목록에 반영한다 (호스트는 방 목록이 곧 내 목록이라 따로 할 게 없다).
 */
function roomEffects(room: RoomState, me: string, role: ShareRole) {
  if (!effectsReady) {
    // 들어오기 전에 있던 일은 적용하지 않는다 — 처음 받은 상태는 본 것으로만 표시한다.
    effectsReady = true;
    room.removed.forEach((r) => seenRemoved.add(removedKey(r)));
    if (room.sync) {
      seenAsk.add(room.sync.id);
      if (room.sync.end) seenSyncEnd.add(room.sync.id);
    }
    return;
  }

  const run = room.sync;
  if (run && !run.end && !seenAsk.has(run.id)) {
    seenAsk.add(run.id);
    if (run.by !== me && !inRoom()) {
      const who = shortName(room.members.find((m) => m.id === run.by)?.name ?? '누군가');
      toast(`${who}님이 식당 정보 동기화를 요청했어요 · 같이 고르기에서 답해 주세요`);
    }
  }
  if (role !== 'client') return;

  const fresh = room.removed.filter((r) => !seenRemoved.has(removedKey(r)));
  if (fresh.length) {
    fresh.forEach((r) => seenRemoved.add(removedKey(r)));
    // 내 목록의 id 는 호스트와 다를 수 있어서 이름으로도 맞춰 본다.
    const ids = new Set(fresh.map((r) => r.id));
    const names = new Set(fresh.map((r) => nameKey(r.name)));
    const drop = useData.getState().restaurants.filter((x) => ids.has(x.id) || names.has(nameKey(x.name)));
    if (drop.length) {
      const gone = new Set(drop.map((x) => x.id));
      useData.getState().apply((d) => ({ ...d, restaurants: d.restaurants.filter((x) => !gone.has(x.id)) }));
      toast(
        drop.length === 1
          ? `‘${drop[0].name}’ 식당을 내 목록에서도 지웠어요`
          : `식당 ${drop.length}곳을 내 목록에서도 지웠어요`,
      );
    }
  }

  if (run?.end && !seenSyncEnd.has(run.id)) {
    seenSyncEnd.add(run.id);
    if (run.end.ok && run.answers[me] === true) {
      const before = useData.getState().restaurants.length;
      useData.getState().apply((d) => ({
        ...d,
        restaurants: mergeRestaurants(d.restaurants, room.restaurants, { fillBlanks: true }),
      }));
      const added = useData.getState().restaurants.length - before;
      toast(
        added
          ? `식당 목록을 동기화했어요 · ${added}곳 추가`
          : '식당 목록을 동기화했어요 · 새로 더할 식당은 없었어요',
      );
    }
  }
}

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
  const name = cleanName(s.name) || '손님';
  return { id: s.shareId, name, hue: hashHue(name) };
};

export const parsePort = (raw: string) => {
  const n = Number(String(raw).trim());
  return Number.isInteger(n) && n >= 1024 && n <= 65535 ? n : null;
};

/** '192.168.0.31:8787' 을 나눈다. ws:// 같은 접두사나 끝의 / 는 떼어 준다. */
export function parseAddr(raw: string): { host: string; port: number } | null {
  const t = raw
    .trim()
    .replace(/^(wss?|https?):\/\//, '')
    .replace(/\/+$/, '');
  const m = /^([\w.-]+):(\d{2,5})$/.exec(t);
  if (!m) return null;
  const port = parsePort(m[2]);
  return port === null ? null : { host: m[1], port };
}

/** 지금 같이 고르기가 열려 있는지 (사이드바·설정에서 쓴다) */
export const isLive = (s: { status: ShareStatus; room: RoomState | null }) =>
  !!s.room && (s.status === 'hosting' || s.status === 'connected' || s.status === 'reconnecting');

export const useShare = create<ShareStore>((set, get) => {
  const setRoom = (room: RoomState, myId: string) => {
    if (inRoom()) markSeen(room);
    set({ room, myId, unread: inRoom() ? 0 : unreadOf(room, myId) });
    roomEffects(room, myId, get().role);
  };

  const fail = (field: ErrField, error: string) =>
    set((s) => ({ error, errField: field, errKey: s.errKey + 1 }));

  const reset = (p: Partial<ShareStore> = {}) => {
    clearTimeout(focusTimer);
    focusTimer = undefined;
    focusSent = null;
    focusWant = null;
    set({
      role: 'none',
      status: 'idle',
      step: -1,
      sync: 0,
      info: null,
      room: null,
      focus: {},
      unread: 0,
      ...p,
    });
    if (inRoom()) useUi.getState().setView('settings');
  };

  return {
    role: 'none',
    status: 'idle',
    step: -1,
    sync: 0,
    error: '',
    errField: null,
    errKey: 0,
    info: null,
    target: null,
    myId: '',
    room: null,
    focus: {},
    unread: 0,
    ended: null,

    startHost: async () => {
      if (get().role !== 'none') return false;
      const port = parsePort(useSettings.getState().port);
      if (port === null) {
        fail('port', '1024–65535 사이 숫자로 입력해 주세요');
        return false;
      }
      const my = ++token;
      lastSeenChat = '';
      resetEffects();
      set({ role: 'host', status: 'starting', step: 0, error: '', errField: null, ended: null });
      const s0 = Date.now();
      const room = createHostRoom({
        onState: (s) => setRoom(s, s.hostId),
        onFocus: (focus) => set({ focus }),
        onGuestJoined: (m) => {
          if (!inRoom()) toast(`${shortName(m.name)}님이 들어왔어요`);
        },
        onError: (msg) => toast(msg),
      });
      try {
        // 1. 포트 확인
        await atLeast(s0, HOST_STEP_MS[0]);
        if (my !== token) throw new Error('');
        set({ step: 1 });
        // 2. 로컬 서버 시작 — 여기서 실제로 포트를 연다
        const s1 = Date.now();
        const info = await hostTransport.start(port, room.handle);
        hostRoom = room;
        await atLeast(s1, HOST_STEP_MS[1]);
        if (my !== token) throw new Error('');
        // 3. 식당 공유 준비
        set({ step: 2, info, myId: room.getState().hostId });
        await delay(HOST_STEP_MS[2]);
        if (my !== token) throw new Error('');
        set({ status: 'hosting', step: 3 });
        toast('서버를 켰어요 · 동료에게 주소를 알려 주세요');
        return true;
      } catch (e) {
        const msg = errText(e);
        if (my !== token) {
          room.dispose('');
          return false;
        }
        hostRoom = null;
        room.dispose('');
        await hostTransport.stop();
        reset();
        if (msg) fail('port', msg);
        return false;
      }
    },

    stopHost: async () => {
      token += 1;
      const room = hostRoom;
      hostRoom = null;
      if (room) {
        room.dispose('호스트가 같이 고르기를 끝냈어요.');
        // 작별 인사가 나갈 틈을 준다.
        await delay(BYE_FLUSH_MS);
      }
      await hostTransport.stop();
      reset();
    },

    join: async (raw) => {
      if (get().role === 'host') return false;
      const addr = parseAddr(raw);
      if (!addr) {
        fail('addr', '주소:포트 형식으로 입력해 주세요');
        return false;
      }
      conn?.close();
      conn = null;
      const my = ++token;
      lastSeenChat = '';
      resetEffects();
      set({
        role: 'client',
        status: 'connecting',
        step: 0,
        sync: 0,
        error: '',
        errField: null,
        target: addr,
        ended: null,
        room: null,
        focus: {},
      });
      const s0 = Date.now();
      let onSocket: () => void = () => {};
      const socketOpen = new Promise<void>((r) => (onSocket = r));
      const joining = joinRoom(addr.host, addr.port, profile, {
        onState: (s, you) => {
          if (my === token) setRoom(s, you);
        },
        onFocus: (focus) => {
          if (my === token) set({ focus });
        },
        onSocket: () => onSocket(),
        onStatus: (status) => {
          // 첫 접속의 단계 표시는 여기서 직접 진행한다. 다시 붙는 중·다시 붙은 뒤만 그대로 반영한다.
          if (my !== token) return;
          if (status === 'reconnecting') set({ status });
          else if (status === 'connected' && get().status === 'reconnecting') set({ status });
        },
        onError: (msg) => {
          if (my === token) toast(msg);
        },
        onEnd: (reason) => {
          if (my !== token) return;
          conn = null;
          reset({ ended: reason });
        },
      });
      try {
        // 1. 호스트 찾는 중 — 소켓이 열릴 때까지
        await Promise.race([socketOpen, joining]);
        await atLeast(s0, CLIENT_STEP_MS[0]);
        if (my !== token) throw new Error('');
        set({ step: 1 });
        // 2. 연결 확인 — 호스트의 welcome 까지
        const s1 = Date.now();
        const c = await joining;
        if (my !== token) {
          c.close();
          return false;
        }
        conn = c;
        await atLeast(s1, CLIENT_STEP_MS[1]);
        if (my !== token) return false;
        // 3. 식당 정보 받는 중 k/N — 받은 목록 수만큼 센다
        const n = get().room?.restaurants.length ?? 0;
        set({ step: 2, sync: 0 });
        for (let k = 1; k <= n; k++) {
          await delay(SYNC_TICK_MS);
          if (my !== token) return false;
          set({ sync: k });
        }
        // 4. 입장 준비
        set({ step: 3 });
        await delay(CLIENT_STEP_MS[3]);
        if (my !== token) return false;
        set({ status: 'connected', step: 4 });

        const st = useSettings.getState();
        const key = `${addr.host}:${addr.port}`;
        const hostName = get().room?.members.find((m) => m.host)?.name ?? '';
        const recents: RecentHost[] = [
          { addr: key, name: shortName(hostName) },
          ...st.recentHosts.filter((h) => h.addr !== key),
        ].slice(0, RECENT_MAX);
        st.patch({ joinAddr: key, recentHosts: recents });
        // 시안처럼 잠깐 '연결됐어요' 를 보여준 뒤 같이 고르기로 들어간다.
        setTimeout(() => {
          if (my === token && get().status === 'connected' && useUi.getState().view === 'settings')
            get().enterRoom();
        }, AUTO_ENTER_MS);
        return true;
      } catch (e) {
        if (my !== token) return false;
        const msg = errText(e);
        conn?.close();
        conn = null;
        clientTransport.disconnect();
        reset();
        if (msg) fail('addr', msg);
        return false;
      }
    },

    cancelJoin: () => {
      token += 1;
      conn?.close();
      conn = null;
      clientTransport.disconnect();
      reset();
    },

    leave: () => {
      token += 1;
      conn?.close();
      conn = null;
      reset();
      toast('연결을 끊었어요');
    },

    act: (a) => {
      const { role, myId } = get();
      if (role === 'host' && hostRoom) hostRoom.act(myId, a);
      else if (role === 'client' && conn) conn.send(a);
    },

    sendFocus: (restId) => {
      focusWant = restId;
      if (focusTimer !== undefined) return;
      focusTimer = setTimeout(() => {
        focusTimer = undefined;
        if (focusWant === focusSent) return;
        focusSent = focusWant;
        get().act({ type: 'focus', restId: focusWant });
      }, FOCUS_SEND_MS);
    },

    kick: (memberId) => hostRoom?.kick(memberId),

    startSync: () =>
      get().act({
        type: 'syncStart',
        restaurants: get().role === 'client' ? useData.getState().restaurants : undefined,
      }),

    answerSync: (accept) => {
      const run = get().room?.sync;
      if (!run || run.end) return;
      get().act({
        type: 'syncAnswer',
        id: run.id,
        accept,
        restaurants: accept && get().role === 'client' ? useData.getState().restaurants : undefined,
      });
    },

    enterRoom: () => {
      if (!isLive(get())) {
        toast('먼저 서버를 켜거나 호스트에 접속해 주세요');
        useUi.getState().setView('settings');
        return;
      }
      markSeen(get().room);
      set({ unread: 0 });
      useUi.getState().setView('together');
    },

    dismissEnded: () => set({ ended: null }),
    clearError: () => set({ error: '', errField: null }),
  };
});

// 같이 고르기 화면에 들어오면 안 읽은 채팅을 비우고, 나가면 내가 보던 카드 표시를 거둔다.
useUi.subscribe((s, prev) => {
  if (s.view === prev.view) return;
  const sh = useShare.getState();
  if (s.view === 'together') {
    markSeen(sh.room);
    useShare.setState({ unread: 0 });
  } else if (prev.view === 'together') {
    sh.sendFocus(null);
  }
});

// 참여 중에 이름을 바꾸면 호스트에 알린다 (호스트 자신은 host.ts 가 설정을 구독한다).
let profileTimer: ReturnType<typeof setTimeout> | undefined;
useSettings.subscribe((s, prev) => {
  if (s.name === prev.name) return;
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
  else if (st.role === 'client') {
    token += 1;
    conn?.close();
    conn = null;
  }
}

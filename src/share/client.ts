/**
 * 같이 고르기 — 참여자 쪽 연결.
 *
 * 접속하면 인사(hello)를 보내고 호스트의 welcome 을 기다린다. 그 뒤로는 호스트가 보내는
 * 방 상태를 그대로 화면에 반영할 뿐이다. 연결이 끊기면 같은 id 로 몇 번 다시 붙어 본다.
 */
import { type Action, type C2H, type FocusMap, type H2C, PROTOCOL, type RoomState } from './protocol';
import { clientTransport } from './transport';

const WELCOME_TIMEOUT_MS = 5000;
const PING_MS = 8000;
const SILENT_MS = 25000;
const RETRY_MS = [1000, 2000, 4000, 6000, 8000, 8000];

export type ClientStatus = 'connecting' | 'connected' | 'reconnecting';

export type ClientCallbacks = {
  onState: (s: RoomState, you: string) => void;
  onFocus: (f: FocusMap) => void;
  /** 소켓이 열렸다 (첫 접속에서만 — 연결 단계 표시에 쓴다) */
  onSocket?: () => void;
  onStatus: (s: ClientStatus) => void;
  onError: (msg: string) => void;
  /** 더 이상 이어갈 수 없게 끝났을 때 (호스트가 닫음, 내보냄, 재접속 실패) */
  onEnd: (reason: string) => void;
};

export type ClientConn = {
  send: (a: Action) => void;
  close: () => void;
};

type Profile = { id: string; name: string; hue: number };

const errText = (e: unknown) => (typeof e === 'string' ? e : e instanceof Error ? e.message : String(e));

/** 접속에 성공해 welcome 을 받으면 resolve 된다. 첫 접속 실패는 reject 로 알린다. */
export function joinRoom(
  host: string,
  port: number,
  profile: () => Profile,
  cb: ClientCallbacks,
): Promise<ClientConn> {
  let you = profile().id;
  let closed = false;
  let lastMsg = Date.now();
  let pingIv: ReturnType<typeof setInterval> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let welcomeTimer: ReturnType<typeof setTimeout> | undefined;

  const wire = (m: C2H) => clientTransport.send(JSON.stringify(m));

  const stopTimers = () => {
    clearInterval(pingIv);
    clearTimeout(retryTimer);
    clearTimeout(welcomeTimer);
    pingIv = undefined;
  };

  const end = (reason: string) => {
    if (closed) return;
    closed = true;
    stopTimers();
    clientTransport.disconnect();
    cb.onEnd(reason);
  };

  /** 한 번 접속해서 welcome 까지 받는다. */
  const attempt = (resume: boolean) =>
    new Promise<void>((resolve, reject) => {
      let welcomed = false;
      let byeReason = '';
      const onMsg = (data: string) => {
        lastMsg = Date.now();
        let m: H2C;
        try {
          m = JSON.parse(data) as H2C;
        } catch {
          return;
        }
        if (m.t === 'welcome') {
          welcomed = true;
          clearTimeout(welcomeTimer);
          you = m.you;
          cb.onState(m.state, you);
          cb.onFocus(m.focus ?? {});
          resolve();
        } else if (m.t === 'state') {
          if (welcomed) cb.onState(m.state, you);
        } else if (m.t === 'focus') {
          if (welcomed) cb.onFocus(m.focus ?? {});
        } else if (m.t === 'err') {
          cb.onError(m.msg);
        } else if (m.t === 'bye') {
          byeReason = m.reason;
        }
      };
      clientTransport
        .connect(host, port, (e) => {
          if (e.kind === 'msg') {
            onMsg(e.data);
            return;
          }
          // 연결이 닫혔다
          if (!welcomed) {
            clearTimeout(welcomeTimer);
            reject(new Error(byeReason || e.reason || '호스트가 연결을 끊었어요.'));
            return;
          }
          if (closed) return;
          if (byeReason) end(byeReason);
          else reconnect();
        })
        .then(() => {
          if (closed) {
            // 붙는 사이에 나가기를 눌렀다 — 늦게 열린 연결을 정리한다.
            clientTransport.disconnect();
            reject(new Error('취소했어요.'));
            return;
          }
          if (!resume) cb.onSocket?.();
          const p = profile();
          wire({
            t: 'hello',
            v: PROTOCOL,
            app: 'lunchpick',
            id: you || p.id,
            name: p.name,
            hue: p.hue,
            resume,
          });
          welcomeTimer = setTimeout(() => {
            clientTransport.disconnect();
            reject(new Error('호스트가 응답하지 않아요. 점심픽 공유 서버가 맞는지 확인해 주세요.'));
          }, WELCOME_TIMEOUT_MS);
        })
        .catch((e) => reject(e instanceof Error ? e : new Error(errText(e))));
    });

  const startHeartbeat = () => {
    clearInterval(pingIv);
    lastMsg = Date.now();
    pingIv = setInterval(() => {
      if (Date.now() - lastMsg > SILENT_MS) {
        // 응답이 끊겼다 — 닫고 다시 붙는다.
        clientTransport.disconnect();
        reconnect();
        return;
      }
      wire({ t: 'ping' });
    }, PING_MS);
  };

  const reconnect = (tryNo = 0) => {
    if (closed) return;
    stopTimers();
    cb.onStatus('reconnecting');
    if (tryNo >= RETRY_MS.length) {
      end('호스트와 연결이 끊겼어요. 호스트 PC가 켜져 있는지 확인하고 다시 접속해 주세요.');
      return;
    }
    retryTimer = setTimeout(() => {
      attempt(true)
        .then(() => {
          if (closed) return;
          cb.onStatus('connected');
          startHeartbeat();
        })
        .catch((e) => {
          if (closed) return;
          const msg = errText(e);
          // 호스트가 일부러 거절한 경우(버전 불일치 등)에는 더 시도하지 않는다.
          if (/버전|내보냈|다른 곳에서/.test(msg)) end(msg);
          else reconnect(tryNo + 1);
        });
    }, RETRY_MS[tryNo]);
  };

  const conn: ClientConn = {
    send: (a) => {
      if (!closed) wire({ t: 'act', a });
    },
    close: () => {
      if (closed) return;
      closed = true;
      stopTimers();
      clientTransport.disconnect();
    },
  };

  cb.onStatus('connecting');
  return attempt(false).then(
    () => {
      if (closed) return conn;
      cb.onStatus('connected');
      startHeartbeat();
      return conn;
    },
    (e) => {
      closed = true;
      stopTimers();
      clientTransport.disconnect();
      throw e;
    },
  );
}

/**
 * 같이 고르기 전송 계층. 방 로직(host.ts / shareStore.ts)은 이 인터페이스만 본다.
 *
 * - Tauri: Rust 의 WebSocket 서버/접속(src-tauri/src/share.rs)을 invoke + 이벤트로 감싼다.
 * - 브라우저(`npm run dev`): 같은 브라우저의 다른 탭끼리 BroadcastChannel 로 흉내 낸다.
 *   호스트 탭에서 서버를 켜고, 다른 탭에서 아무 주소 + 같은 포트로 접속하면 된다.
 */
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import { hasTauri } from '../lib/ipc';

export type HostInfo = { port: number; addrs: string[]; pcName: string };

export type HostEvent =
  | { kind: 'open'; peer: string; addr?: string }
  | { kind: 'msg'; peer: string; data: string }
  | { kind: 'close'; peer: string };

export type ClientEvent = { kind: 'msg'; data: string } | { kind: 'close'; reason?: string };

export interface HostTransport {
  start(port: number, onEvent: (e: HostEvent) => void): Promise<HostInfo>;
  send(peers: string[], text: string): void;
  kick(peer: string): void;
  stop(): Promise<void>;
}

export interface ClientTransport {
  connect(host: string, port: number, onEvent: (e: ClientEvent) => void): Promise<void>;
  send(text: string): void;
  disconnect(): void;
}

// 세션 번호. 서버를 다시 켜거나 다시 접속하면 바뀌어서, 이전 세션의 늦은 이벤트를 버린다.
let genSeq = Date.now();
const nextGen = () => ++genSeq;

// ---------------------------------------------------------------- Tauri

type RawHostEvent = { gen: number; kind: string; peer: string; addr?: string; data?: string };
type RawClientEvent = { gen: number; kind: string; data?: string; reason?: string };

function tauriHost(): HostTransport {
  let gen = 0;
  let handler: ((e: HostEvent) => void) | null = null;
  let unlisten: Promise<() => void> | null = null;

  const ensureListener = () => {
    unlisten ??= listen<RawHostEvent>('share-host', ({ payload: p }) => {
      if (p.gen !== gen || !handler) return;
      if (p.kind === 'open') handler({ kind: 'open', peer: p.peer, addr: p.addr });
      else if (p.kind === 'msg' && typeof p.data === 'string')
        handler({ kind: 'msg', peer: p.peer, data: p.data });
      else if (p.kind === 'close') handler({ kind: 'close', peer: p.peer });
    });
    return unlisten;
  };

  return {
    async start(port, onEvent) {
      await ensureListener();
      gen = nextGen();
      handler = onEvent;
      try {
        return await invoke<HostInfo>('share_host_start', { port, gen });
      } catch (e) {
        handler = null;
        throw e;
      }
    },
    send(peers, text) {
      if (!peers.length) return;
      invoke('share_host_send', { peers, text }).catch(() => {});
    },
    kick(peer) {
      invoke('share_host_kick', { peer }).catch(() => {});
    },
    async stop() {
      handler = null;
      gen = 0;
      await invoke('share_host_stop').catch(() => {});
    },
  };
}

function tauriClient(): ClientTransport {
  let gen = 0;
  let handler: ((e: ClientEvent) => void) | null = null;
  let unlisten: Promise<() => void> | null = null;

  const ensureListener = () => {
    unlisten ??= listen<RawClientEvent>('share-client', ({ payload: p }) => {
      if (p.gen !== gen || !handler) return;
      if (p.kind === 'msg' && typeof p.data === 'string') handler({ kind: 'msg', data: p.data });
      else if (p.kind === 'close') {
        const h = handler;
        handler = null;
        h({ kind: 'close', reason: p.reason });
      }
    });
    return unlisten;
  };

  return {
    async connect(host, port, onEvent) {
      await ensureListener();
      gen = nextGen();
      handler = onEvent;
      try {
        await invoke('share_client_connect', { host, port, gen });
      } catch (e) {
        handler = null;
        throw e;
      }
    },
    send(text) {
      invoke('share_client_send', { text }).catch(() => {});
    },
    disconnect() {
      handler = null;
      gen = 0;
      invoke('share_client_disconnect').catch(() => {});
    },
  };
}

// ---------------------------------------------------------------- 브라우저 (개발용)

type Wire =
  | { k: 'open'; cid: string }
  | { k: 'ack'; to: string }
  | { k: 'c2h'; cid: string; data: string }
  | { k: 'h2c'; to: string; data: string }
  | { k: 'close'; cid: string }
  | { k: 'kick'; to: string }
  | { k: 'down' };

const chName = (port: number) => `lunchpick-share-${port}`;
const ACK_TIMEOUT_MS = 1200;

function devHost(): HostTransport {
  let ch: BroadcastChannel | null = null;
  let emit: ((e: HostEvent) => void) | null = null;
  const peers = new Set<string>();
  const onUnload = () => ch?.postMessage({ k: 'down' } satisfies Wire);

  return {
    async start(port, onEvent) {
      ch?.close();
      peers.clear();
      emit = onEvent;
      ch = new BroadcastChannel(chName(port));
      ch.onmessage = ({ data: m }: MessageEvent<Wire>) => {
        if (m.k === 'open') {
          peers.add(m.cid);
          ch?.postMessage({ k: 'ack', to: m.cid } satisfies Wire);
          onEvent({ kind: 'open', peer: m.cid, addr: '같은 브라우저' });
        } else if (m.k === 'c2h' && peers.has(m.cid)) {
          onEvent({ kind: 'msg', peer: m.cid, data: m.data });
        } else if (m.k === 'close' && peers.delete(m.cid)) {
          onEvent({ kind: 'close', peer: m.cid });
        }
      };
      window.addEventListener('beforeunload', onUnload);
      return { port, addrs: ['127.0.0.1'], pcName: '개발용 브라우저' };
    },
    send(to, text) {
      for (const p of to) if (peers.has(p)) ch?.postMessage({ k: 'h2c', to: p, data: text } satisfies Wire);
    },
    kick(peer) {
      if (!peers.has(peer)) return;
      ch?.postMessage({ k: 'kick', to: peer } satisfies Wire);
      peers.delete(peer);
      // 실제 서버처럼 연결이 끊긴 이벤트를 비동기로 올려 준다.
      const h = emit;
      setTimeout(() => h?.({ kind: 'close', peer }), 0);
    },
    async stop() {
      ch?.postMessage({ k: 'down' } satisfies Wire);
      window.removeEventListener('beforeunload', onUnload);
      ch?.close();
      ch = null;
      emit = null;
      peers.clear();
    },
  };
}

function devClient(): ClientTransport {
  let ch: BroadcastChannel | null = null;
  let cid = '';
  let handler: ((e: ClientEvent) => void) | null = null;
  const onUnload = () => ch?.postMessage({ k: 'close', cid } satisfies Wire);

  const drop = (reason?: string) => {
    const h = handler;
    handler = null;
    window.removeEventListener('beforeunload', onUnload);
    ch?.close();
    ch = null;
    h?.({ kind: 'close', reason });
  };

  return {
    connect(_host, port, onEvent) {
      ch?.close();
      cid = `t${Math.random().toString(36).slice(2, 8)}`;
      const c = new BroadcastChannel(chName(port));
      ch = c;
      return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          c.close();
          if (ch === c) ch = null;
          reject(
            new Error(
              `포트 ${port} 에서 열린 같이 고르기를 찾지 못했어요. (개발 모드: 다른 탭에서 서버를 먼저 켜 주세요)`,
            ),
          );
        }, ACK_TIMEOUT_MS);
        c.onmessage = ({ data: m }: MessageEvent<Wire>) => {
          if (m.k === 'ack' && m.to === cid) {
            clearTimeout(timer);
            handler = onEvent;
            window.addEventListener('beforeunload', onUnload);
            resolve();
          } else if (m.k === 'h2c' && m.to === cid) {
            handler?.({ kind: 'msg', data: m.data });
          } else if ((m.k === 'kick' && m.to === cid) || m.k === 'down') {
            drop();
          }
        };
        c.postMessage({ k: 'open', cid } satisfies Wire);
      });
    },
    send(text) {
      ch?.postMessage({ k: 'c2h', cid, data: text } satisfies Wire);
    },
    disconnect() {
      ch?.postMessage({ k: 'close', cid } satisfies Wire);
      handler = null;
      window.removeEventListener('beforeunload', onUnload);
      ch?.close();
      ch = null;
    },
  };
}

export const hostTransport: HostTransport = hasTauri ? tauriHost() : devHost();
export const clientTransport: ClientTransport = hasTauri ? tauriClient() : devClient();

/** 서버를 켜기 전에도 내 주소를 보여주기 위해 쓴다. */
export async function localInfo(port: number): Promise<HostInfo> {
  if (!hasTauri) return { port, addrs: ['127.0.0.1'], pcName: '개발용 브라우저' };
  return invoke<HostInfo>('share_local_info', { port });
}

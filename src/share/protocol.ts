/**
 * 같이 고르기 프로토콜. 호스트와 참여자가 주고받는 JSON 의 모양은 여기에만 있다.
 * (Rust 는 텍스트를 전달만 한다 — src-tauri/src/share.rs)
 *
 * 원칙
 * - 방 상태(RoomState)는 호스트만 바꾼다. 참여자는 Action 을 보내고, 호스트가 적용한 뒤
 *   상태 전체를 다시 방송한다. 상태가 작아서(수십 KB) 부분 갱신보다 단순하고 어긋나지 않는다.
 * - 식당 세부정보를 보는 건 각자 화면에서만 일어난다 — 상태에 넣지 않는다.
 * - AI 에 보낸 원문은 호스트 메모리에만 있고 방송하지 않는다. 키워드만 공개한다.
 */
import type { Restaurant } from '../lib/types';

/** 호환되지 않게 바뀌면 올린다. 다르면 접속을 거절한다. */
export const PROTOCOL = 1;

export const LIMITS = {
  name: 16,
  chat: 300,
  chatKeep: 200,
  prompt: 200,
  aiPending: 6,
  aiKeep: 12,
  rollMax: 6,
  ladderMax: 8,
  memo: 200,
  menus: 40,
  menuName: 30,
} as const;

export type Member = {
  /** 설정의 shareId (겹치면 호스트가 뒤에 꼬리를 붙여 준다) */
  id: string;
  name: string;
  hue: number;
  host: boolean;
  online: boolean;
  typing: boolean;
  joinedAt: number;
};

export type ChatMsg =
  | { id: string; at: number; kind: 'chat'; from: string; text: string }
  | { id: string; at: number; kind: 'sys'; text: string; tone: SysTone; by?: string };

export type SysTone = 'info' | 'ai' | 'pick' | 'ladder' | 'final' | 'edit';

export type AiTurn = {
  id: string;
  by: string;
  /** 공개되는 주요 키워드. 대기 중일 때는 비어 있다. */
  keywords: string[];
  status: 'queued' | 'running' | 'done' | 'failed';
  at: number;
  /** AI 대신 키워드 정렬로 처리했거나 실패한 이유 */
  note?: string;
};

/** 무작위 n곳 뽑기. seq[i] 는 i 번째 당첨까지 깜빡이며 지나가는 식당 id 들 (마지막이 당첨). */
export type Roll = {
  id: string;
  by: string;
  count: number;
  seq: string[][];
  picks: string[];
  /** 한 칸 깜빡임 간격(ms) 배율 — 호스트의 애니메이션 속도 */
  speed: number;
  done: boolean;
};

export type LadderRun = {
  id: string;
  by: string;
  /** 사다리 위쪽에 놓인 순서대로의 후보 id */
  cands: string[];
  keep: number;
  rungs: boolean[][];
  slots: boolean[];
  winners: string[];
  speed: number;
  done: boolean;
};

export type Final = { restId: string; by: string; at: number };

export type RoomState = {
  v: number;
  rev: number;
  hostId: string;
  /** 호스트 PC 에 AI 키가 등록돼 있는지 — 없으면 키워드 정렬로 대신한다 */
  aiReady: boolean;
  members: Member[];
  restaurants: Restaurant[];
  /** 식당 id -> 가기 싫다고 한 사람 id 들 */
  dislikes: Record<string, string[]>;
  /** 식당 id -> 후보에 올린 사람 */
  cands: Record<string, { by: string; at: number }>;
  /** AI 가 정렬한 식당 id 순서. 비어 있으면 기본(분류·이름) 순서 */
  order: string[];
  /** AI 가 앞쪽 몇 곳에 붙인 짧은 이유 */
  reasons: Record<string, string>;
  ai: AiTurn[];
  roll: Roll | null;
  ladder: LadderRun | null;
  final: Final | null;
  chat: ChatMsg[];
};

export type EditableRest = Pick<Restaurant, 'id' | 'category' | 'phone' | 'memo' | 'menus'>;

export type Action =
  | { type: 'chat'; text: string }
  | { type: 'typing' }
  | { type: 'dislike'; restId: string }
  | { type: 'cand'; restId: string }
  | { type: 'clearCands' }
  | { type: 'roll'; count: number }
  | { type: 'ai'; prompt: string }
  | { type: 'aiReset' }
  | { type: 'ladder'; keep: number }
  | { type: 'final'; restId: string }
  | { type: 'unfinal' }
  | { type: 'editRest'; rest: EditableRest }
  | { type: 'profile'; name: string; hue: number };

/** 참여자 → 호스트 */
export type C2H =
  | {
      t: 'hello';
      v: number;
      app: 'lunchpick';
      id: string;
      name: string;
      hue: number;
      /** 끊겼다가 다시 붙는 중 — 같은 id 의 이전 연결을 대신한다 */
      resume?: boolean;
    }
  | { t: 'act'; a: Action }
  | { t: 'ping' };

/** 호스트 → 참여자 */
export type H2C =
  | { t: 'welcome'; you: string; state: RoomState }
  | { t: 'state'; state: RoomState }
  | { t: 'pong' }
  | { t: 'err'; msg: string }
  | { t: 'bye'; reason: string };

export const AVATAR_HUES = [40, 155, 250, 320, 85, 200, 10, 285];

/** 이름 첫 글자 (아바타용) */
export const initial = (name: string) => (name.trim() ? Array.from(name.trim())[0] : '?');

export const cleanName = (raw: unknown) =>
  String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LIMITS.name);

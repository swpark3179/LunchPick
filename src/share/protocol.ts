/**
 * 같이 고르기 프로토콜. 호스트와 참여자가 주고받는 JSON 의 모양은 여기에만 있다.
 * (Rust 는 텍스트를 전달만 한다 — src-tauri/src/share.rs)
 *
 * 원칙
 * - 방 상태(RoomState)는 호스트만 바꾼다. 참여자는 Action 을 보내고, 호스트가 적용한 뒤
 *   상태 전체를 다시 방송한다. 상태가 작아서(수십 KB) 부분 갱신보다 단순하고 어긋나지 않는다.
 * - 식당 세부정보를 보는 건 각자 화면에서만 일어난다 — 상태에 넣지 않는다.
 * - AI 에 보낸 원문은 호스트 메모리에만 있고 방송하지 않는다. 키워드만 공개한다.
 * - '누가 어느 카드를 보고 있는지'(focus)는 자주 바뀌므로 방 상태와 따로, 작은 메시지로 보낸다.
 * - 방은 두 종류다. 점심(lunch)은 호스트의 식당 목록으로 고르고, 도란식사(doran)는 방 안에서 식당·메뉴를
 *   입력해 '선택지'(식당 + 메뉴 구성)를 만들어 좁힌다. 도란식사에서 살아 있는 선택지는 cands 에 둔다
 *   (그래서 사다리·하트 걸기가 그대로 돈다). 방 종류에 맞지 않는 Action 은 호스트가 거절한다.
 */
import type { Menu, Restaurant } from '../lib/types';
import { HUES } from '../theme';

/** 호환되지 않게 바뀌면 올린다. 다르면 접속을 거절한다. */
export const PROTOCOL = 5;

export type RoomKind = 'lunch' | 'doran';

/** 호스트가 앱을 끄면 참여자들에게 남기는 말 (Rust 가 맡아 뒀다가 보낸다 — transport.ts › start) */
export const HOST_QUIT_REASON = '호스트가 점심픽을 종료했어요.';

/** 채팅 리액션 — 순서대로 고르기 줄과 칩에 놓인다. 모양·이름은 화면(reactions.ts)이 정한다. */
export const REACTION_KEYS = ['yes', 'no', 'good', 'thanks', 'smile', 'wow', 'oops', 'tear', 'check'] as const;
export type ReactKey = (typeof REACTION_KEYS)[number];

export const LIMITS = {
  name: 12,
  chat: 300,
  chatKeep: 200,
  prompt: 200,
  aiPending: 6,
  aiKeep: 12,
  /** AI 큐 팝업에 보여주는 순위 수 */
  aiTop: 5,
  rollMax: 5,
  ladderMax: 8,
  /** 하트 걸기에 올릴 수 있는 후보 수 */
  prefMax: 6,
  /** 하트 걸기에서 한 사람이 가진 하트 수 */
  prefHearts: 3,
  memo: 200,
  menus: 40,
  menuName: 30,
  /** 동기화로 한 사람이 보낼 수 있는 식당 수 */
  syncRests: 500,
  /** 지운 식당 기록을 몇 개까지 남길지 */
  removedKeep: 50,
  /** 한 사람이 고르거나 예약에 담을 수 있는 메뉴 가짓수 */
  orderItems: 20,
  /** 한 사람이 메뉴 하나를 몇 개까지 고를 수 있는지 */
  pickQty: 9,
  /** 예약에서 메뉴 하나를 몇 개까지 담을 수 있는지 */
  reserveQty: 99,
  reserveNote: 300,
  /** 같은 사람을 다시 부를 수 있기까지 (ms) */
  callCooldownMs: 30000,
  /** 도란식사 — 방에 올릴 수 있는 식당 수 */
  doranRests: 40,
  /** 도란식사 — 한 번에 만들 수 있는 선택지 수 */
  choices: 30,
  choiceLabel: 20,
  choiceNote: 100,
  /** 도란식사 — 총사용금액 상한 */
  budgetMax: 99_999_999,
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
  | {
      id: string;
      at: number;
      kind: 'chat';
      from: string;
      text: string;
      /** 리액션 -> 누른 사람 id 들 (아무도 없으면 키가 없다) */
      react?: Partial<Record<ReactKey, string[]>>;
    }
  | { id: string; at: number; kind: 'sys'; text: string; by?: string };

export type AiTurn = {
  id: string;
  by: string;
  /** 공개되는 주요 키워드 (대기 중에는 사전으로 뽑은 것, 끝나면 AI 가 준 것) */
  keywords: string[];
  status: 'queued' | 'running' | 'done' | 'failed';
  at: number;
  /** 이 요청으로 순서가 바뀐 식당 수 */
  moved?: number;
  /** AI 대신 키워드 정렬로 처리했거나 실패한 이유 */
  note?: string;
  /** 반영됐을 때의 차수 ('n차') */
  no?: number;
  /** 이 요청의 앞쪽 몇 곳 (AI 큐 팝업용). 식당이 지워져도 보이게 이름을 함께 남긴다. */
  top?: { id: string; name: string; why?: string }[];
  /** 보낸 사람이 붙인 임의 id — 내 원문을 내 칩에 짝지을 때만 쓴다 */
  ref?: string;
};

/**
 * 무작위 n곳 뽑기. seq[i] 는 i 번째 당첨까지 스포트라이트가 건너뛰며 지나가는 식당 id 들이고,
 * 마지막이 당첨이다. 시간표는 anim.ts 의 rollTimeline 이 모든 화면에서 똑같이 계산한다.
 */
export type Roll = {
  id: string;
  by: string;
  count: number;
  seq: string[][];
  picks: string[];
  /** 호스트의 애니메이션 속도 배율 */
  speed: number;
  done: boolean;
};

/** 사다리 — 모두가 같은 사다리를 보고, 누구든 출발·결과 적용을 누를 수 있다. */
export type LadderRun = {
  id: string;
  by: string;
  /** 사다리 위쪽에 놓인 순서대로의 후보 id */
  cands: string[];
  keep: number;
  rungs: boolean[][];
  /** 아래 칸 중 당첨 칸 */
  slots: boolean[];
  /** 출발한 줄 / 도착해서 결과가 드러난 줄 */
  drawn: boolean[];
  revealed: boolean[];
  speed: number;
};

/**
 * 하트 걸기 — 열 때의 후보에 각자 하트를 나눠 건다 (한 곳에 몰면 강한 선호). 건 하트는 바로
 * 모두에게 보이고, 누구든 마감하면 하트 수로 순위가 나온다. 무작위는 없고, 결과는 참고용이라
 * 어떤 후보든 그대로 확정할 수 있다.
 */
export type PrefRun = {
  id: string;
  by: string;
  /** 1부터 — '동점끼리 한 번 더' 를 하면 올라간다 */
  round: number;
  /** 열 때 고정한 후보 id (칸 순서) */
  cands: string[];
  /** 한 사람이 가진 하트 수 */
  hearts: number;
  /** 멤버 id -> 후보별 하트 수 (cands 와 같은 길이). 아직 안 걸었으면 없다. */
  bets: Record<string, number[]>;
  /** '아무데나 좋아요' 를 누른 사람 */
  pass: string[];
  /** 마감 — 결과를 보는 중이면 누가 언제 마감했는지 */
  closed: { by: string; at: number } | null;
};

/** 확정. 도란식사면 choiceId 가 확정된 선택지이고 restId 는 그 선택지의 식당이다. */
export type Final = { restId: string; by: string; at: number; choiceId?: string };

/**
 * 도란식사의 선택지 — 식당 하나 + (있으면) 메뉴 구성. 같은 식당으로 여러 개를 만들 수 있다.
 * no 는 방 안에서 오르기만 하는 번호라 지워도 다시 쓰지 않는다 ('A안', 'B안' …).
 */
export type Choice = {
  id: string;
  no: number;
  restId: string;
  items: OrderItem[];
  /** 붙인 이름 (없으면 빈 문자열) */
  label: string;
  note: string;
  by: string;
  at: number;
};

/**
 * 메뉴 한 줄. 식당 목록의 메뉴면 menuId 가 있고, 목록에 없어 직접 적은 메뉴는 이름만 있다.
 * 이름·가격은 고른 때의 값을 남긴다 (그 뒤에 식당 정보가 고쳐져도 그대로 보이게).
 */
export type OrderItem = { menuId: string | null; name: string; price: number | null; qty: number };

/** 확정된 식당에서 한 사람이 고른 메뉴 */
export type MenuPick = { items: OrderItem[]; at: number };

/** 누군가 식당에 예약하고 '예약 완료'를 누르면 모두에게 공유되는 내용 */
export type Reservation = {
  by: string;
  at: number;
  restId: string;
  /** 실제로 예약한 메뉴 — 각자 고른 메뉴와 다를 수 있다 */
  items: OrderItem[];
  /** 특이사항 */
  note: string;
  /** 예약할 때 각자 고른 메뉴 (멤버 id -> 메뉴) — 그 뒤에 바뀐 메뉴를 알려 줄 때 이것과 비교한다 */
  basis: Record<string, OrderItem[]>;
  /** 마지막으로 고친 사람 (처음 예약 그대로면 null). 호스트가 고쳐도 예약한 사람(by)은 그대로다. */
  editedBy: string | null;
};

/** 예약을 마지막으로 보낸 사람 (예약했거나 고친 사람) */
export const reservationAuthor = (v: Reservation) => v.editedBy ?? v.by;

/**
 * 식당 정보 동기화 — 누구든 요청하면 모두에게 수락/거절을 묻는다. 방의 식당 목록은 호스트
 * 목록이라 호스트가 수락해야 합쳐지고, 끝나면 수락한 사람들이 합쳐진 목록을 각자 받는다.
 */
export type SyncRun = {
  id: string;
  by: string;
  at: number;
  /** 응답 마감 (호스트 시계) */
  until: number;
  /** 멤버 id -> 수락(true) / 거절(false) */
  answers: Record<string, boolean>;
  end: { ok: boolean; added: number; reason?: string; at: number } | null;
};

/** 같이 고르기 중에 지운 식당 — 참여자들도 각자 목록에서 지운다 */
export type Removed = { id: string; name: string; by: string; at: number };

export type RoomState = {
  v: number;
  rev: number;
  kind: RoomKind;
  hostId: string;
  /** 호스트 PC 에 AI 키가 등록돼 있는지 — 없으면 키워드 정렬로 대신한다 */
  aiReady: boolean;
  members: Member[];
  restaurants: Restaurant[];
  /** 식당 id -> 가기 싫다고 한 사람 id 들 */
  dislikes: Record<string, string[]>;
  /** 가기 싫은 곳으로 빠진 순서 */
  exclOrder: string[];
  /** 식당 id -> 후보에 올린 사람 */
  cands: Record<string, { by: string; at: number }>;
  /** AI 가 정렬한 식당 id 순서. 비어 있으면 식당 목록 순서 */
  order: string[];
  /** AI 가 앞쪽 몇 곳에 붙인 짧은 이유 */
  reasons: Record<string, string>;
  /** 지금까지의 정렬 요청에서 나온 태그 (카드의 #태그 강조에 쓴다) */
  aiTags: string[];
  /** 반영된 AI 정렬 횟수 ('n차') */
  aiTurns: number;
  /** 마지막 정렬로 바뀐 자리 (식당 id -> 올라간 칸 수, 음수는 내려감). 잠시 뒤 지운다. */
  delta: { id: string; map: Record<string, number> } | null;
  ai: AiTurn[];
  roll: Roll | null;
  ladder: LadderRun | null;
  pref: PrefRun | null;
  /** 마지막 하트 걸기 결과 (식당 id -> 하트 수) — 닫은 뒤에도 후보 칩에 ♥n 으로 남는다 */
  prefTally: Record<string, number> | null;
  final: Final | null;
  /** 확정된 식당에서 각자 고른 메뉴 (멤버 id -> 메뉴). 확정이 바뀌거나 풀리면 비운다. */
  picks: Record<string, MenuPick>;
  reservation: Reservation | null;
  /** 지금 예약 화면을 열어 둔 사람 — 두 사람이 같이 전화하지 않게 모두에게 보인다 */
  reserving: { by: string; at: number } | null;
  /** 같이 고르기 중에 정보를 고친 식당 (방금 수정됨 표시) */
  edited: Record<string, number>;
  chat: ChatMsg[];
  sync: SyncRun | null;
  removed: Removed[];
  /** 도란식사 — 선택지 (만든 순서). 살아 있는 건 cands 에 있다. 점심 방에서는 비어 있다. */
  choices: Choice[];
  /** 도란식사 — 마지막으로 매긴 선택지 번호 */
  choiceSeq: number;
  /** 도란식사 — 총사용금액 (정하지 않았으면 null) */
  budget: number | null;
};

/** 도란식사에서 입력·수정하는 식당 (id 가 없으면 새 식당) */
export type DoranRestInput = {
  id?: string;
  name: string;
  category: string;
  phone: string;
  memo: string;
  menus: { id?: string; name: string; price: number | null }[];
};

export type EditableRest = { id: string; phone: string; memo: string; menus: Menu[] };

export type Action =
  | { type: 'chat'; text: string }
  | { type: 'typing' }
  | { type: 'focus'; restId: string | null }
  | { type: 'dislike'; restId: string }
  /** 후보에 올리기/내리기 — 도란식사에서는 선택지(restId 자리에 선택지 id)를 빼기/되살리기 */
  | { type: 'cand'; restId: string }
  /** 무작위 — 점심은 n곳을 후보로 올리고, 도란식사는 살아 있는 선택지 중 n개만 남긴다 */
  | { type: 'roll'; count: number }
  | { type: 'ai'; prompt: string; ref?: string }
  | { type: 'aiReset' }
  | { type: 'aiRemove'; id: string }
  | { type: 'ladder'; keep: number }
  | { type: 'ladderRun'; i: number }
  | { type: 'ladderAll' }
  | { type: 'ladderApply' }
  | { type: 'ladderClose' }
  /** 하트 걸기 열기. retie 면 마감된 결과의 공동 1위끼리 한 번 더 */
  | { type: 'pref'; retie?: boolean }
  /** 내가 건 하트 전체 (후보 순서). pass 면 '아무데나 좋아요' */
  | { type: 'prefBet'; id: string; hearts: number[]; pass?: boolean }
  /** 마감 / 다시 걸기 / 하트 0개 후보 내리기 / 닫기 */
  | { type: 'prefClose' | 'prefReopen' | 'prefDrop' | 'prefCancel'; id: string }
  | { type: 'final'; restId: string }
  | { type: 'unfinal' }
  /**
   * 내가 고른 메뉴 전체 (빈 배열이면 비운다). final 은 고를 때 본 확정 시각 — 그사이 다른 식당으로
   * 바뀌었으면 호스트가 버린다 (예전 화면은 보내지 않으니 없으면 그대로 받는다).
   */
  | { type: 'pickMenu'; items: OrderItem[]; final?: number }
  /** 예약 화면을 열었다(true) / 닫았다(false) */
  | { type: 'reserving'; on: boolean }
  /** 예약 완료 — 이미 예약이 있으면 고친다 */
  | { type: 'reserve'; items: OrderItem[]; note: string }
  | { type: 'unreserve' }
  | { type: 'editRest'; rest: EditableRest }
  | { type: 'removeRest'; restId: string }
  /** 참여자가 시작하면 자기 식당 목록을 함께 보낸다 */
  | { type: 'syncStart'; restaurants?: Restaurant[] }
  | { type: 'syncAnswer'; id: string; accept: boolean; restaurants?: Restaurant[] }
  | { type: 'profile'; name: string; hue: number }
  /** 한 사람을 부른다 — 그 사람 PC 에서 점심픽 창이 한 번 맨 앞으로 뜬다 */
  | { type: 'call'; to: string }
  /** 남의 채팅에 리액션을 달거나(없으면) 뗀다(있으면) */
  | { type: 'react'; msgId: string; key: ReactKey }
  // ---- 도란식사 (점심 방에서는 거절)
  /** 식당 추가(id 없음)·수정 */
  | { type: 'dRestSave'; rest: DoranRestInput }
  /** 내 PC 에 저장해 둔 식당들을 방에 올린다 */
  | { type: 'dRestLoad'; restaurants: Restaurant[] }
  | { type: 'dRestRemove'; restId: string }
  | { type: 'choiceAdd'; restId: string; items: OrderItem[]; label?: string; note?: string }
  | { type: 'choiceEdit'; id: string; items: OrderItem[]; label?: string; note?: string }
  | { type: 'choiceRemove'; id: string }
  | { type: 'choiceFinal'; id: string }
  /** 총사용금액 (null 이면 지운다) */
  | { type: 'budget'; amount: number | null };

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
  | { t: 'ping' }
  /** 방 찾기 — 들어가지 않고 방이 열려 있는지만 묻는다 (hello 없이 보내고 답을 받으면 닫는다) */
  | { t: 'probe' };

/** 누가(멤버 id) 어느 식당 카드(식당 id)를 보고 있는지 */
export type FocusMap = Record<string, string>;

/** 호스트 → 참여자 */
export type H2C =
  | { t: 'welcome'; you: string; state: RoomState; focus: FocusMap }
  | { t: 'state'; state: RoomState }
  | { t: 'focus'; focus: FocusMap }
  | { t: 'pong' }
  /** 누군가(멤버 id) 나를 불렀다 — 불린 사람에게만 간다 */
  | { t: 'call'; by: string }
  /** probe 에 대한 답 */
  | { t: 'info'; v: number; host: string; online: number; kind?: RoomKind }
  | { t: 'err'; msg: string }
  | { t: 'bye'; reason: string };

// ---------------------------------------------------------------- 이름

export const cleanName = (raw: unknown) =>
  String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LIMITS.name);

/** 세 글자 한글 이름은 성을 뺀 두 글자로 부른다 ('박서원' → '서원'). */
export const shortName = (n: string) => (/^[가-힣]{3}$/.test(n.trim()) ? n.trim().slice(1) : n.trim());

/** 아바타 글자 — 세 글자 이상 한글 이름은 2·3번째 글자, 그 밖에는 앞 두 글자 */
export const initials = (raw: string) => {
  const n = raw.trim() || '?';
  return /^[가-힣]{3,}$/.test(n) ? n.slice(1, 3) : Array.from(n).slice(0, 2).join('');
};

/** 이름에서 아바타 색을 정한다 — 같은 이름은 어느 PC 에서나 같은 색이다. */
export const hashHue = (s: string) => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length];
};

/** 받침에 따라 조사를 고른다. josa('진주집', '이', '가') → '진주집이' */
export const josa = (w: string, withBatchim: string, without: string) => {
  const c = w.charCodeAt(w.length - 1);
  if (!(c >= 0xac00 && c <= 0xd7a3)) return w + without;
  return w + ((c - 0xac00) % 28 ? withBatchim : without);
};

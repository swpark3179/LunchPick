/**
 * 도란식사 정하기 — 호스트와 화면이 같이 쓰는 계산.
 *
 * - 선택지(Choice)는 식당 하나 + 메뉴 구성(없을 수도 있다). 이름은 번호로 'A안', 'B안' … 이라 부른다.
 * - 합계는 가격이 정해진 메뉴만 더한다. 가격 미정 메뉴가 끼면 '확정 금액 + α' 로 보이고,
 *   총사용금액과 비교할 때도 α 가 남은 금액 안에 들어오면 맞는다고 알려 준다.
 * - 같이 고르기 화면 조각(사다리·하트 걸기 …)은 후보 id 를 받는다. 점심 방에서는 식당 id, 도란식사 방에서는
 *   선택지 id 라서 이름·존재 여부는 여기 함수(candLabel · candExists)로 묻는다.
 */
import { nameKey, sanitizeRestaurants } from '../lib/shareFormat';
import type { Restaurant } from '../lib/types';
import { uid, won } from '../lib/util';
import { itemKey, sumItems } from './order';
import { type Choice, josa, LIMITS, type OrderItem, type RoomKind, type RoomState } from './protocol';

// ---------------------------------------------------------------- 이름

/** 1 → 'A', 26 → 'Z', 27 → 'AA' … */
export function choiceCode(no: number) {
  let n = Math.max(1, Math.floor(no));
  let out = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** 'A안' */
export const choiceName = (c: Pick<Choice, 'no'>) => `${choiceCode(c.no)}안`;

export const choiceOf = (room: Pick<RoomState, 'choices'>, id: string) =>
  room.choices.find((c) => c.id === id);

const restName = (room: Pick<RoomState, 'restaurants'>, id: string) =>
  room.restaurants.find((r) => r.id === id)?.name ?? '';

/** 'A안 진주집' (이름을 붙였으면 'A안 회 코스') */
export function choiceTitle(room: Pick<RoomState, 'restaurants'>, c: Choice) {
  const what = c.label || restName(room, c.restId);
  return what ? `${choiceName(c)} ${what}` : choiceName(c);
}

type CandRoom = Pick<RoomState, 'kind' | 'restaurants' | 'choices'>;

/** 후보 id 가 지금 방에 있는지 — 점심은 식당, 도란식사는 선택지 */
export const candExists = (room: CandRoom, id: string) =>
  room.kind === 'doran' ? room.choices.some((c) => c.id === id) : room.restaurants.some((r) => r.id === id);

/** 채팅·사다리·하트 걸기에 쓰는 후보 이름 */
export function candLabel(room: CandRoom, id: string) {
  if (room.kind !== 'doran') return restName(room, id);
  const c = choiceOf(room, id);
  return c ? choiceTitle(room, c) : '';
}

/** 후보를 세는 말 — 점심은 '곳', 도란식사는 '개' */
export const unitOf = (room: Pick<RoomState, 'kind'>) => (room.kind === 'doran' ? '개' : '곳');

/** 방 종류 이름 */
export const kindName = (kind: RoomKind | null | undefined) =>
  kind === 'doran' ? '도란식사' : '같이 고르기';

/** 'A안을' 처럼 조사를 붙인 선택지 이름 */
export const choiceObj = (c: Pick<Choice, 'no'>) => josa(choiceName(c), '을', '를');

// ---------------------------------------------------------------- 금액

export type Money = {
  /** 가격이 정해진 메뉴의 합 */
  sum: number;
  /** 가격 미정 메뉴 가짓수 */
  unknown: number;
  /** 담은 개수 */
  count: number;
};

export function moneyOf(items: readonly OrderItem[]): Money {
  let sum = 0;
  let unknown = 0;
  let count = 0;
  for (const it of items) {
    count += it.qty;
    if (it.price == null) unknown += 1;
    else sum += it.price * it.qty;
  }
  return { sum, unknown, count };
}

/** '128,000원' · '98,000원 + α' · '가격 미정' · '메뉴 미정' */
export function moneyText(items: readonly OrderItem[]) {
  if (!items.length) return '메뉴 미정';
  const m = moneyOf(items);
  if (!m.sum) return '가격 미정';
  return m.unknown ? `${won(m.sum)} + α` : won(m.sum);
}

export type FitTone = 'under' | 'exact' | 'over' | 'maybe';
export type Fit = { tone: FitTone; text: string };

/**
 * 총사용금액과 비교한다. 메뉴가 없거나 예산을 정하지 않았으면 null.
 * 가격 미정 메뉴가 있으면 확정 금액이 이미 넘었는지, 아니면 α 가 얼마 안이어야 맞는지 알려 준다.
 */
export function budgetFit(items: readonly OrderItem[], budget: number | null): Fit | null {
  if (!budget || !items.length) return null;
  const { sum, unknown } = moneyOf(items);
  if (!unknown) {
    if (sum < budget) return { tone: 'under', text: `${won(budget - sum)} 남아요` };
    if (sum === budget) return { tone: 'exact', text: '딱 맞아요' };
    return { tone: 'over', text: `${won(sum - budget)} 초과` };
  }
  if (sum < budget) return { tone: 'maybe', text: `+α가 ${won(budget - sum)} 안이면 맞아요` };
  if (sum === budget) return { tone: 'over', text: '+α만큼 초과' };
  return { tone: 'over', text: `${won(sum - budget)} + α 초과` };
}

/** '모둠회(대) ×1 · 소주 ×5' */
export const itemsLine = (items: readonly OrderItem[]) =>
  items.map((it) => `${it.name} ×${it.qty}`).join(' · ');

/** 같은 메뉴 구성인지 (순서는 상관없다) */
export function sameItems(a: readonly OrderItem[], b: readonly OrderItem[]) {
  const sig = (l: readonly OrderItem[]) =>
    l
      .map((it) => `${itemKey(it)}*${it.qty}`)
      .sort()
      .join('|');
  return sig(a) === sig(b);
}

/**
 * 예약 화면을 처음 채울 메뉴 — 점심은 모두가 고른 메뉴의 합, 도란식사는 확정된 선택지의 메뉴.
 */
export function reserveBase(room: RoomState, r: Restaurant | undefined): OrderItem[] {
  if (room.kind === 'doran') {
    const c = room.final?.choiceId ? choiceOf(room, room.final.choiceId) : undefined;
    return (c?.items ?? []).map((it) => ({ ...it, qty: Math.min(it.qty, LIMITS.reserveQty) }));
  }
  return sumItems(
    Object.values(room.picks).map((p) => p.items),
    r,
  ).map((it) => ({ ...it, qty: Math.min(it.qty, LIMITS.reserveQty) }));
}

// ---------------------------------------------------------------- 식당

/**
 * 도란식사 식당 id — 식당마다 파일 하나로 저장하고 파일 이름으로 쓴다 (Windows 는 대소문자를 가리지 않아 소문자만).
 * src-tauri/src/storage.rs 의 valid_doran_id 와 같아야 한다.
 */
export const DORAN_ID = /^[a-z0-9_-]{1,40}$/;

const REST_NAME_MAX = 30;

/** 내용이 같은지 볼 때 쓰는 서명 (보관함에 다시 저장할지 정한다) */
export const restSig = (r: Restaurant) =>
  JSON.stringify([r.name, r.category, r.phone, r.memo, r.menus.map((m) => [m.id, m.name, m.price])]);

const freshId = (taken: ReadonlySet<string>) => {
  let id = uid();
  while (taken.has(id) || !DORAN_ID.test(id)) id = uid();
  return id;
};

/**
 * 받은 식당 하나를 검증·정규화한다. 이름이 없으면 null.
 * - cur 가 있으면 고치는 중이다 — id 와 메뉴 id·★ 를 이어받는다.
 * - 새 식당은 keepId 이고 형식이 맞고 taken 에 없을 때만 받은 id 를 쓰고(보관함에서 불러오기), 아니면 새로 만든다.
 */
export function cleanDoranRest(
  raw: unknown,
  opts: { cur?: Restaurant; taken: ReadonlySet<string>; keepId?: boolean },
): Restaurant | null {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  // 이름 없는 메뉴 줄은 먼저 덜어내서 아래에서 받은 줄(rawMenus)과 정리된 줄(base.menus)의 순서가 맞게 한다.
  const rawMenus = (Array.isArray(o.menus) ? o.menus : [])
    .filter(
      (m): m is Record<string, unknown> => !!m && typeof m === 'object' && !!String(m.name ?? '').trim(),
    )
    .slice(0, LIMITS.menus);
  // 이름·분류·전화·메모·메뉴 모양은 식당 목록 가져오기와 같은 규칙으로 정리한다.
  const [base] = sanitizeRestaurants([{ ...o, id: 'x', menus: rawMenus }], 1, LIMITS.menus);
  if (!base) return null;
  const name = base.name.replace(/\s+/g, ' ').slice(0, REST_NAME_MAX);
  if (!name) return null;
  const { cur, taken } = opts;
  const rawId = String(o.id ?? '');
  const id = cur ? cur.id : opts.keepId && DORAN_ID.test(rawId) && !taken.has(rawId) ? rawId : freshId(taken);
  const menuIds = new Set<string>();
  const menus = base.menus
    .map((m, i) => {
      const old = cur?.menus.find((x) => x.id === String(rawMenus[i]?.id ?? ''));
      const want = String(rawMenus[i]?.id ?? '');
      let mid = old ? old.id : opts.keepId && DORAN_ID.test(want) ? want : '';
      if (!mid || menuIds.has(mid)) mid = freshId(menuIds);
      menuIds.add(mid);
      const p = m.price;
      return {
        id: mid,
        name: m.name.replace(/\s+/g, ' ').slice(0, LIMITS.menuName),
        price: p !== null && Number.isFinite(p) && p > 0 ? Math.min(Math.round(p), 9_999_999) : null,
        fav: old ? old.fav : m.fav,
      };
    })
    .filter((m) => m.name);
  return {
    id,
    name,
    category: base.category,
    phone: base.phone,
    memo: base.memo.slice(0, LIMITS.memo),
    fav: cur ? cur.fav : false,
    menus,
  };
}

/** 이름이 같은 식당이 이미 있는지 (자기 자신은 빼고) */
export const nameTaken = (list: readonly Restaurant[], name: string, selfId?: string) =>
  list.some((r) => r.id !== selfId && nameKey(r.name) === nameKey(name));

/** '9,000 ~ 32,000원' (가격이 하나도 없으면 빈 문자열) */
export function priceRange(r: Restaurant) {
  const ps = r.menus.map((m) => m.price).filter((p): p is number => p != null);
  if (!ps.length) return '';
  const lo = Math.min(...ps);
  const hi = Math.max(...ps);
  return lo === hi ? won(lo) : `${lo.toLocaleString('ko-KR')} ~ ${won(hi)}`;
}

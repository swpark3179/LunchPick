/**
 * 확정 뒤 메뉴 고르기 · 예약 — 호스트와 화면이 같이 쓰는 계산.
 * 메뉴 줄(OrderItem)은 식당 메뉴면 menuId 로, 직접 적은 메뉴는 이름으로 같은 메뉴를 알아본다.
 */
import { nameKey } from '../lib/shareFormat';
import type { Restaurant } from '../lib/types';
import { hhmm, won } from '../lib/util';
import { LIMITS, type OrderItem, type RoomState } from './protocol';

export const itemKey = (it: Pick<OrderItem, 'menuId' | 'name'>) => it.menuId ?? `n:${nameKey(it.name)}`;

/** 같은 메뉴·같은 수량·같은 순서인지 비교할 때 쓰는 서명 */
export const itemsSig = (items: readonly OrderItem[]) =>
  items.map((it) => `${itemKey(it)}*${it.qty}`).join('|');

const cleanPrice = (raw: unknown) => {
  const p = Number(raw);
  return Number.isFinite(p) && p > 0 ? Math.min(Math.round(p), 9_999_999) : null;
};

/**
 * 받은 메뉴 줄을 검증한다. 식당 메뉴와 맞으면(id, 없으면 이름) 그 메뉴의 id·이름·가격을 쓰고,
 * 아니면 직접 적은 메뉴로 둔다. 수량이 1보다 작은 줄은 빼고, 같은 메뉴는 합친다.
 * 화면도 보내기 전에 같은 함수로 정리한다 — 호스트가 돌려준 값과 그대로 맞춰 보기 위해서다.
 */
export function cleanItems(raw: unknown, rest: Restaurant | undefined, maxQty: number): OrderItem[] {
  const out = new Map<string, OrderItem>();
  for (const x of (Array.isArray(raw) ? raw : []).slice(0, LIMITS.orderItems * 2)) {
    if (!x || typeof x !== 'object') continue;
    const it = x as Partial<OrderItem>;
    const qty = Math.floor(Number(it.qty));
    if (!Number.isFinite(qty) || qty < 1) continue;
    const name = String(it.name ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, LIMITS.menuName);
    const menu =
      rest?.menus.find((m) => m.id === it.menuId) ??
      (name ? rest?.menus.find((m) => nameKey(m.name) === nameKey(name)) : undefined);
    const base: OrderItem = menu
      ? { menuId: menu.id, name: menu.name, price: menu.price, qty: 0 }
      : { menuId: null, name, price: cleanPrice(it.price), qty: 0 };
    if (!base.name) continue;
    const k = itemKey(base);
    const cur = out.get(k);
    if (!cur && out.size >= LIMITS.orderItems) continue;
    out.set(k, { ...(cur ?? base), qty: Math.min(maxQty, (cur?.qty ?? 0) + qty) });
  }
  return [...out.values()];
}

/** 여러 사람이 고른 메뉴를 합친다 — 식당 메뉴 순서대로, 직접 적은 메뉴는 그 뒤에 나온 순서대로. */
export function sumItems(lists: readonly (readonly OrderItem[])[], rest?: Restaurant): OrderItem[] {
  const m = new Map<string, OrderItem>();
  for (const l of lists)
    for (const it of l) {
      const k = itemKey(it);
      const cur = m.get(k);
      m.set(k, cur ? { ...cur, qty: cur.qty + it.qty } : { ...it });
    }
  const order = new Map(rest?.menus.map((x, i) => [x.id, i]) ?? []);
  return [...m.values()].sort(
    (a, b) => (order.get(a.menuId ?? '') ?? 1e9) - (order.get(b.menuId ?? '') ?? 1e9),
  );
}

export const totalOf = (items: readonly OrderItem[]) => ({
  count: items.reduce((n, it) => n + it.qty, 0),
  sum: items.reduce((n, it) => n + (it.price ?? 0) * it.qty, 0),
  /** 가격을 모르는 메뉴가 섞여 있다 */
  unknown: items.some((it) => it.price == null),
});

/** '4개 · 27,000원' (가격 모르는 메뉴가 있으면 '+ 가격 미정') */
export const totalText = (items: readonly OrderItem[]) => {
  const t = totalOf(items);
  if (!t.count) return '';
  const money = t.sum ? `${won(t.sum)}${t.unknown ? ' + 가격 미정' : ''}` : '가격 미정';
  return `${t.count}개 · ${money}`;
};

/** '김치찌개 3 · 된장찌개 2' */
export const itemsText = (items: readonly OrderItem[]) =>
  items.map((it) => `${it.name} ${it.qty}`).join(' · ');

/** base 에서 now 로 바뀐 수량. 같으면 빈 문자열. ('김치찌개 +1 · 된장찌개 −1') */
export function diffItems(now: readonly OrderItem[], base: readonly OrderItem[]) {
  const a = new Map(now.map((it) => [itemKey(it), it]));
  const b = new Map(base.map((it) => [itemKey(it), it]));
  const keys = [...new Set([...b.keys(), ...a.keys()])];
  return keys
    .map((k) => {
      const d = (a.get(k)?.qty ?? 0) - (b.get(k)?.qty ?? 0);
      if (!d) return '';
      const name = (a.get(k) ?? b.get(k))!.name;
      return `${name} ${d > 0 ? '+' : '−'}${Math.abs(d)}`;
    })
    .filter(Boolean)
    .join(' · ');
}

const lineText = (it: OrderItem) =>
  `- ${it.name} × ${it.qty}${it.price ? ` (${won(it.price * it.qty)})` : ''}`;

const fullName = (room: RoomState, id: string) => room.members.find((m) => m.id === id)?.name ?? '누군가';

/** 예약 내용을 클립보드용 글로 */
export function reservationText(room: RoomState) {
  const v = room.reservation;
  if (!v) return '';
  const r = room.restaurants.find((x) => x.id === v.restId);
  return [
    `[점심픽] ${r?.name ?? ''} 예약`,
    r?.phone ? `전화 ${r.phone}` : '',
    `예약 ${fullName(room, v.by)} · ${hhmm(v.at)}`,
    ...v.items.map(lineText),
    v.items.length ? `합계 ${totalText(v.items)}` : '',
    v.note ? `특이사항: ${v.note}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** 각자 고른 메뉴를 클립보드용 글로 */
export function picksText(room: RoomState) {
  const f = room.final;
  if (!f) return '';
  const r = room.restaurants.find((x) => x.id === f.restId);
  const who = room.members.filter((m) => room.picks[m.id]?.items.length);
  const all = sumItems(
    who.map((m) => room.picks[m.id].items),
    r,
  );
  return [
    `[점심픽] ${r?.name ?? ''} · 각자 고른 메뉴`,
    ...who.map((m) => `${m.name}: ${itemsText(room.picks[m.id].items)}`),
    all.length ? `합계: ${itemsText(all)} (${totalText(all)})` : '아직 고른 메뉴가 없어요',
  ].join('\n');
}

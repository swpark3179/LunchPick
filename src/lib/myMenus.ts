/**
 * 늘 먹는 메뉴 — '이 식당이면 나는 이 메뉴'. 내 PC 의 data.json 에만 두는 개인 데이터다.
 * 식당 목록(restaurants)과 따로 두어서 같이 고르기 방·식당 동기화·내보내기로 나가지 않는다.
 *
 * 식당과 메뉴는 이름(nameKey)으로 맞춘다. 참여자 목록은 호스트와 id 가 다르고, 내 목록에 없는
 * 방 식당에도 정해 둘 수 있어야 해서다 (동기화·삭제도 이름으로 맞춘다).
 */
import { nameKey } from './shareFormat';
import type { MyMenus, Restaurant } from './types';

/** 식당 하나에 정해 둘 수 있는 메뉴 수 (같이 고르기에서 한 사람이 고를 수 있는 가짓수와 같다) */
export const MY_MENU_MAX = 20;
const NAME_MAX = 30;

const NONE: readonly string[] = [];

const cleanName = (raw: unknown) =>
  String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX);

/** 같은 메뉴(nameKey)는 처음 것만 남기고 상한에서 자른다. */
function uniq(names: readonly string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    const k = nameKey(n);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(n);
  }
  return out.slice(0, MY_MENU_MAX);
}

/** 불러온 값을 정리한다 — 모양이 어긋난 항목은 버린다. */
export function cleanMyMenus(raw: unknown): MyMenus {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: MyMenus = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = nameKey(k);
    if (!key || !Array.isArray(v)) continue;
    const names = uniq([...(out[key] ?? []), ...v.map(cleanName)]);
    if (names.length) out[key] = names;
  }
  return out;
}

/** 이 식당의 늘 먹는 메뉴 이름들 */
export const namesFor = (my: MyMenus, restName: string): readonly string[] => my[nameKey(restName)] ?? NONE;

export const isMyMenu = (my: MyMenus, restName: string, menuName: string) =>
  namesFor(my, restName).some((n) => nameKey(n) === nameKey(menuName));

/** 이 식당의 늘 먹는 메뉴를 names 로 바꾼다 (비면 지운다). */
export function withNames(my: MyMenus, restName: string, names: readonly string[]): MyMenus {
  const key = nameKey(restName);
  if (!key) return my;
  const out = { ...my };
  const list = uniq(names.map(cleanName));
  if (list.length) out[key] = list;
  else delete out[key];
  return out;
}

/** 메뉴 하나를 늘 먹는 메뉴에 넣거나 뺀다. */
export function toggled(my: MyMenus, restName: string, menuName: string): MyMenus {
  const cur = namesFor(my, restName);
  const k = nameKey(menuName);
  return withNames(
    my,
    restName,
    cur.some((n) => nameKey(n) === k) ? cur.filter((n) => nameKey(n) !== k) : [...cur, menuName],
  );
}

/**
 * 식당 목록이 바뀔 때 늘 먹는 메뉴가 따라가게 한다 — 식당 이름이 바뀌면 키를 옮기고,
 * 메뉴 이름이 바뀌면(같은 id) 이름을 바꾸고, 지운 메뉴는 뺀다. 내 목록에 없던 메뉴(방에서
 * 정한 것)는 건드리지 않는다. 바뀐 게 없으면 같은 객체를 돌려준다.
 */
export function followRenames(
  prev: readonly Restaurant[],
  next: readonly Restaurant[],
  my: MyMenus,
): MyMenus {
  if (prev === next || !Object.keys(my).length) return my;
  const before = new Map(prev.map((r) => [r.id, r]));
  let out: MyMenus | null = null;
  for (const r of next) {
    const old = before.get(r.id);
    if (!old || old === r) continue;
    const from = nameKey(old.name);
    const names = (out ?? my)[from];
    if (!names) continue;
    const nowById = new Map(r.menus.map((m) => [m.id, m]));
    const nowKeys = new Set(r.menus.map((m) => nameKey(m.name)));
    const list = names.flatMap((n) => {
      const k = nameKey(n);
      const was = old.menus.find((m) => nameKey(m.name) === k);
      if (!was) return [n];
      const now = nowById.get(was.id);
      if (now) return [now.name];
      return nowKeys.has(k) ? [n] : [];
    });
    const to = nameKey(r.name);
    const same = to === from && list.length === names.length && list.every((n, i) => n === names[i]);
    if (same) continue;
    out ??= { ...my };
    if (to !== from) delete out[from];
    const merged = uniq(to === from ? list : [...(out[to] ?? []), ...list]);
    if (merged.length) out[to] = merged;
    else delete out[to];
  }
  return out ?? my;
}

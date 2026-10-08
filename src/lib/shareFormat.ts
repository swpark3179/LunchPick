/**
 * 식당 목록 공유 포맷. 내보낸 파일을 그대로 다시 가져와도 동작해야 한다 (round-trip).
 * 먹은 기록(history)은 개인 데이터라 내보내지 않는다.
 */
import { CATS } from '../theme';
import type { Menu, Restaurant } from './types';
import { fmtPhone, uid } from './util';

export const SHARE_FORMAT = 'lunchpick.restaurants';
export const SHARE_VERSION = 1;

export type ShareFile = {
  format: string;
  version: number;
  exportedAt: string;
  count: number;
  restaurants: Restaurant[];
};

export function buildShareJson(restaurants: Restaurant[]): string {
  const payload: ShareFile = {
    format: SHARE_FORMAT,
    version: SHARE_VERSION,
    exportedAt: new Date().toISOString(),
    count: restaurants.length,
    restaurants: restaurants.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      phone: r.phone,
      memo: r.memo ?? '',
      fav: !!r.fav,
      menus: r.menus.map((m) => ({
        id: m.id,
        name: m.name,
        price: m.price ?? null,
        fav: !!m.fav,
      })),
    })),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

class ShareError extends Error {}

const asString = (v: unknown) => (typeof v === 'string' ? v : '');
const asNumberOrNull = (v: unknown) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function normalizeMenu(raw: unknown): Menu | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const name = asString(o.name).trim();
  if (!name) return null;
  return {
    id: asString(o.id).trim() || uid(),
    name,
    price: asNumberOrNull(o.price),
    fav: o.fav === true,
  };
}

function normalizeRestaurant(raw: unknown): Restaurant | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const name = asString(o.name).trim();
  if (!name) return null;
  const category = asString(o.category).trim();
  const menus = Array.isArray(o.menus)
    ? o.menus.map(normalizeMenu).filter((m): m is Menu => m !== null)
    : [];
  return {
    id: asString(o.id).trim() || uid(),
    name,
    // 모르는 분류는 기타로 떨어뜨린다 (공유 파일이 다른 버전에서 왔을 수 있다).
    category: (CATS as readonly string[]).includes(category) ? category : '기타',
    phone: fmtPhone(asString(o.phone)),
    memo: asString(o.memo).trim(),
    fav: o.fav === true,
    menus,
  };
}

/** 사용자가 고른 파일을 검증·정규화한다. 실패 시 한국어 메시지와 함께 throw. */
export function parseShareJson(text: string): Restaurant[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ShareError('JSON 파일이 아니거나 내용이 손상됐어요.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ShareError('점심픽 식당 목록 파일이 아니에요.');
  }
  const o = parsed as Record<string, unknown>;
  if (asString(o.format) !== SHARE_FORMAT) {
    throw new ShareError('점심픽 식당 목록 파일이 아니에요. (format 값이 달라요)');
  }
  const version = Number(o.version);
  if (!Number.isFinite(version) || version > SHARE_VERSION) {
    throw new ShareError(`이 파일은 더 새로운 버전(v${o.version})이에요. 앱을 업데이트해 주세요.`);
  }
  if (!Array.isArray(o.restaurants)) {
    throw new ShareError('파일에 restaurants 목록이 없어요.');
  }
  const list = o.restaurants
    .map(normalizeRestaurant)
    .filter((r): r is Restaurant => r !== null);
  if (!list.length) {
    throw new ShareError('파일에 가져올 식당이 없어요.');
  }
  return list;
}

export type ImportSummary = {
  /** 파일에 담긴 식당 수 */
  total: number;
  /** 이름이 기존 목록과 겹치는 식당 수 */
  overlap: number;
  /** 합치기로 새로 추가될 식당 수 */
  added: number;
  /** 합치기로 기존 식당에 추가될 메뉴 수 */
  addedMenus: number;
};

/** 식당·메뉴를 이름으로 맞춰 볼 때의 키 */
export const nameKey = (s: string) => s.trim().toLowerCase();

/**
 * 네트워크로 받은 식당 목록을 검증·정규화한다 (같이 고르기 동기화).
 * 이상한 항목은 버리고, 개수와 메뉴 수는 상한에서 자른다.
 */
export function sanitizeRestaurants(raw: unknown, max: number, maxMenus: number): Restaurant[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, max)
    .map(normalizeRestaurant)
    .filter((r): r is Restaurant => r !== null)
    .map((r) => ({ ...r, menus: r.menus.slice(0, maxMenus) }));
}

export function summarizeImport(incoming: Restaurant[], current: Restaurant[]): ImportSummary {
  const byName = new Map(current.map((r) => [nameKey(r.name), r]));
  let overlap = 0;
  let added = 0;
  let addedMenus = 0;
  for (const inc of incoming) {
    const mine = byName.get(nameKey(inc.name));
    if (!mine) {
      added += 1;
      continue;
    }
    overlap += 1;
    const have = new Set(mine.menus.map((m) => nameKey(m.name)));
    addedMenus += inc.menus.filter((m) => !have.has(nameKey(m.name))).length;
  }
  return { total: incoming.length, overlap, added, addedMenus };
}

/**
 * 합치기: 식당 이름 기준으로 매칭한다.
 * - 없는 식당은 추가 (id 충돌 시 재발급)
 * - 있는 식당은 **메뉴만** 이름 기준으로 추가하고, 기존 phone/memo/fav 는 보존한다
 * - fillBlanks 면 있는 식당의 비어 있는 전화번호·메모만 채운다 (같이 고르기 동기화)
 */
export function mergeRestaurants(
  current: Restaurant[],
  incoming: Restaurant[],
  opts: { fillBlanks?: boolean } = {},
): Restaurant[] {
  const takeId = idClaimer(current.flatMap((r) => [r.id, ...r.menus.map((m) => m.id)]));

  const out = current.map((r) => ({ ...r, menus: [...r.menus] }));
  const indexByName = new Map(out.map((r, i) => [nameKey(r.name), i]));

  for (const inc of incoming) {
    const at = indexByName.get(nameKey(inc.name));
    if (at === undefined) {
      const added: Restaurant = {
        ...inc,
        id: takeId(inc.id),
        menus: inc.menus.map((m) => ({ ...m, id: takeId(m.id) })),
      };
      out.push(added);
      indexByName.set(nameKey(added.name), out.length - 1);
      continue;
    }
    const mine = out[at];
    if (opts.fillBlanks) {
      if (!mine.phone && inc.phone) mine.phone = inc.phone;
      if (!mine.memo && inc.memo) mine.memo = inc.memo;
    }
    const have = new Set(mine.menus.map((m) => nameKey(m.name)));
    for (const m of inc.menus) {
      if (have.has(nameKey(m.name))) continue;
      have.add(nameKey(m.name));
      mine.menus.push({ ...m, id: takeId(m.id) });
    }
  }
  return out;
}

/** 전체 교체: 가져온 목록으로 완전히 덮어쓴다. id 중복만 정리한다. */
export function replaceRestaurants(incoming: Restaurant[]): Restaurant[] {
  const takeId = idClaimer([]);
  return incoming.map((r) => ({
    ...r,
    id: takeId(r.id),
    menus: r.menus.map((m) => ({ ...m, id: takeId(m.id) })),
  }));
}

/**
 * id 를 선점하는 헬퍼. 비어 있거나 이미 쓰인 id 면 새로 발급한다.
 * 공유 파일끼리 id 가 겹칠 수 있어서 가져오기 경로에서는 항상 이걸 통과시킨다.
 */
function idClaimer(initial: readonly string[]) {
  const used = new Set(initial.filter(Boolean));
  return (candidate: string): string => {
    if (candidate && !used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    let next = uid();
    while (used.has(next)) next = uid();
    used.add(next);
    return next;
  };
}

/** 엑셀용 CSV (목업과 동일한 열 구성 · BOM · CRLF). */
export function buildCsv(restaurants: Restaurant[]): string {
  const rows: (string | number)[][] = [
    ['식당명', '분류', '전화번호', '메모', '메뉴', '가격', '대표'],
  ];
  for (const r of restaurants) {
    if (!r.menus.length) rows.push([r.name, r.category, r.phone, r.memo || '', '', '', '']);
    for (const m of r.menus) {
      rows.push([r.name, r.category, r.phone, r.memo || '', m.name, m.price ?? '', m.fav ? 'Y' : '']);
    }
  }
  const body = rows
    .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  return `﻿${body}`;
}

/** 내보내기 기본 파일명 — 2026-10-06 형태의 날짜를 붙인다. */
export function exportFileName(ext: 'json' | 'csv') {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `점심픽_식당목록_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.${ext}`;
}

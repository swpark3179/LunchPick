import type { HistoryEntry, Menu, Restaurant } from './types';

export const DAY = 86400000;

export const uid = () => Math.random().toString(36).slice(2, 9);

export const shuffle = <T,>(a: readonly T[]): T[] => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

export const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];

/** 9000 -> "9,000원", null/빈값 -> "" */
export const won = (p: number | null | undefined) =>
  p === null || p === undefined || (p as unknown) === '' ? '' : `${Number(p).toLocaleString('ko-KR')}원`;

/**
 * 입력 중에도 자연스럽게 하이픈을 넣는다. 02 지역번호, 050X 안심번호
 * (0507-1469-7968 처럼 앞자리가 4자리, 최대 12자리), 1588-1234 같은 대표번호(8자리)만 특별 처리.
 */
export const fmtPhone = (v: string) => {
  const all = String(v).replace(/\D/g, '');
  if (all.startsWith('1')) {
    const d = all.slice(0, 8);
    return d.length <= 4 ? d : `${d.slice(0, 4)}-${d.slice(4)}`;
  }
  if (all.startsWith('050')) {
    const d = all.slice(0, 12);
    if (d.length <= 4) return d;
    if (d.length <= 7) return `${d.slice(0, 4)}-${d.slice(4)}`;
    if (d.length <= 11) return `${d.slice(0, 4)}-${d.slice(4, 7)}-${d.slice(7)}`;
    return `${d.slice(0, 4)}-${d.slice(4, 8)}-${d.slice(8)}`;
  }
  const d = all.slice(0, 11);
  if (d.startsWith('02')) {
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
  }
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
};

/** 전화번호는 비워도 된다. 대표번호(1xxx)는 8자리, 나머지는 9자리 이상이어야 한다. */
export const phoneOk = (v: string) => {
  const d = v.replace(/\D/g, '');
  return !d || (d.startsWith('1') ? d.length === 8 : d.length >= 9);
};

/** 가격 입력 필드용 — 숫자만 받아 천단위 구분을 붙인다. */
export const priceFmt = (t: string) => {
  const d = t.replace(/\D/g, '').slice(0, 7);
  return d ? Number(d).toLocaleString('ko-KR') : '';
};

export const short = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/** 즐겨찾기 메뉴를 앞으로 보내고 n개만. */
export const topMenus = (r: Pick<Restaurant, 'menus'>, n: number): Menu[] => {
  const f = r.menus.filter((m) => m.fav);
  const o = r.menus.filter((m) => !m.fav);
  return [...f, ...o].slice(0, n);
};

export const lastAt = (history: readonly HistoryEntry[], id: string) => {
  let t = 0;
  for (const h of history) if (h.restId === id && h.at > t) t = h.at;
  return t;
};

/** 자정 기준 며칠 전인지. 기록이 없으면 null. */
export const daysAgo = (t: number) => {
  if (!t) return null;
  const a = new Date();
  a.setHours(0, 0, 0, 0);
  const b = new Date(t);
  b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / DAY);
};

export const agoText = (d: number | null) =>
  d === null ? '' : d === 0 ? '오늘 먹음' : d === 1 ? '어제 먹음' : `${d}일 전`;

export const todayText = () =>
  new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });

export const longDateText = () =>
  new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });

/** 시각을 '13:05' 처럼 */
export const hhmm = (at: number) => {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * 도란식사 식당 보관함 — 내 PC 에 식당마다 파일 하나로 둔다 (%APPDATA%\com.lunchpick.desktop\doran\<id>.json).
 *
 * - 도란식사 방에 올라온 식당은 호스트·참여자 모두 자기 보관함에 자동으로 저장된다 (shareStore 가 remember 를 부른다).
 *   내용이 그대로면 다시 쓰지 않고, 이름이 같은 다른 식당 파일은 새 것으로 바꾼다.
 * - 다음 도란식사 때 '저장한 식당 불러오기'에서 몇 곳만 골라 방에 올린다.
 * - 쓰기는 하나씩 차례로 한다 (같은 파일을 겹쳐 쓰지 않게).
 */
import { create } from 'zustand';

import { doranDelete, doranList, doranSave } from '../lib/ipc';
import { nameKey } from '../lib/shareFormat';
import type { Restaurant } from '../lib/types';
import { cleanDoranRest, DORAN_ID, restSig } from '../share/doran';
import { toastError } from './uiStore';

export const DORAN_FORMAT = 'lunchpick.doran';
const DORAN_VERSION = 1;

export type DoranEntry = { restaurant: Restaurant; savedAt: number };

type DoranState = {
  entries: DoranEntry[];
  /** 한 번이라도 디스크에서 읽었는지 */
  loaded: boolean;
  loading: boolean;
  /** 보관함을 읽는다 (force 가 아니면 처음 한 번만) */
  load: (force?: boolean) => Promise<void>;
  /** 방의 식당들을 보관함에 저장한다 — 바뀐 것만 쓴다 */
  remember: (rests: readonly Restaurant[]) => Promise<void>;
  forget: (id: string) => Promise<void>;
};

/** 파일 하나를 검증한다 — 모양이 어긋나면 버린다 */
function parseEntry(raw: unknown): DoranEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.format !== DORAN_FORMAT || Number(o.version) > DORAN_VERSION) return null;
  const r = o.restaurant as Record<string, unknown> | undefined;
  if (!r || !DORAN_ID.test(String(r.id ?? ''))) return null;
  const rest = cleanDoranRest(r, { taken: new Set(), keepId: true });
  if (!rest) return null;
  const savedAt = Number(o.savedAt);
  return { restaurant: rest, savedAt: Number.isFinite(savedAt) ? savedAt : 0 };
}

const byRecent = (a: DoranEntry, b: DoranEntry) => b.savedAt - a.savedAt;

/** 쓰기를 차례로 잇는 사슬 */
let chain: Promise<unknown> = Promise.resolve();
const queue = <T>(job: () => Promise<T>) => {
  const p = chain.then(job, job);
  chain = p.catch(() => {});
  return p;
};

export const useDoran = create<DoranState>((set, get) => ({
  entries: [],
  loaded: false,
  loading: false,

  load: async (force = false) => {
    if ((get().loaded && !force) || get().loading) return;
    set({ loading: true });
    try {
      // 쓰는 중이던 게 있으면 끝난 뒤에 읽는다.
      await chain;
      const all = (await doranList()).map(parseEntry).filter((e): e is DoranEntry => !!e);
      set({ entries: all.sort(byRecent), loaded: true });
    } catch (e) {
      toastError(e, '식당 보관함을 읽지 못했어요');
    } finally {
      set({ loading: false });
    }
  },

  remember: async (rests) => {
    if (!rests.length) return;
    await get().load();
    const now = Date.now();
    const cur = get().entries;
    const changed = rests.filter((r) => {
      const had = cur.find((e) => e.restaurant.id === r.id);
      return !had || restSig(had.restaurant) !== restSig(r);
    });
    if (!changed.length) return;
    const ids = new Set(changed.map((r) => r.id));
    const names = new Set(changed.map((r) => nameKey(r.name)));
    // 이름이 같은 다른 식당(다른 PC 에서 따로 입력한 것)은 새 것으로 바꾼다.
    const replaced = cur.filter((e) => !ids.has(e.restaurant.id) && names.has(nameKey(e.restaurant.name)));
    const fresh = changed.map((r) => ({ restaurant: r, savedAt: now }));
    set({
      entries: [...fresh, ...cur.filter((e) => !ids.has(e.restaurant.id) && !replaced.includes(e))].sort(
        byRecent,
      ),
    });
    await queue(async () => {
      try {
        for (const e of fresh)
          await doranSave(e.restaurant.id, {
            format: DORAN_FORMAT,
            version: DORAN_VERSION,
            savedAt: e.savedAt,
            restaurant: e.restaurant,
          });
        for (const e of replaced) await doranDelete(e.restaurant.id);
      } catch (err) {
        toastError(err, '식당을 보관함에 저장하지 못했어요');
      }
    });
  },

  forget: async (id) => {
    set({ entries: get().entries.filter((e) => e.restaurant.id !== id) });
    await queue(async () => {
      try {
        await doranDelete(id);
      } catch (err) {
        toastError(err, '보관함에서 지우지 못했어요');
      }
    });
  },
}));

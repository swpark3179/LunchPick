import { create } from 'zustand';

import { loadData, saveData } from '../lib/ipc';
import { seed } from '../lib/seed';
import type { AppData, Restaurant } from '../lib/types';
import { toastError } from './uiStore';

const SAVE_DEBOUNCE_MS = 400;

type DataState = AppData & {
  ready: boolean;
  /** 앱 시작 시 디스크에서 불러오고, 없으면 샘플 데이터를 심는다. */
  init: () => Promise<void>;
  /** 모든 변경은 이 함수를 통과한다 — 자동 저장이 걸려 있다. */
  apply: (fn: (d: AppData) => AppData) => void;
  updateRest: (id: string, fn: (r: Restaurant) => Restaurant) => void;
  /** 최종 1곳이 확정되면 먹은 기록을 남긴다. */
  recordEaten: (restId: string) => void;
  reset: () => void;
};

let saveTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleSave(data: AppData) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveData(data).catch((e) => toastError(e, '저장 실패'));
  }, SAVE_DEBOUNCE_MS);
}

export const useData = create<DataState>((set, get) => ({
  restaurants: [],
  history: [],
  ready: false,

  init: async () => {
    let data: AppData;
    try {
      const loaded = await loadData();
      // history 가 없는 예전 파일도 받아들인다.
      data =
        loaded && Array.isArray(loaded.restaurants)
          ? {
              restaurants: loaded.restaurants,
              history: Array.isArray(loaded.history) ? loaded.history : [],
            }
          : seed();
      // 처음 실행이면 샘플 데이터를 바로 디스크에 쓴다.
      if (!loaded) await saveData(data);
    } catch (e) {
      toastError(e);
      data = seed();
    }
    set({ ...data, ready: true });
  },

  apply: (fn) => {
    const { restaurants, history } = get();
    const next = fn({ restaurants, history });
    set(next);
    scheduleSave(next);
  },

  updateRest: (id, fn) =>
    get().apply((d) => ({ ...d, restaurants: d.restaurants.map((r) => (r.id === id ? fn(r) : r)) })),

  recordEaten: (restId) =>
    get().apply((d) => ({ ...d, history: [...d.history, { restId, at: Date.now() }] })),

  reset: () => get().apply(() => seed()),
}));

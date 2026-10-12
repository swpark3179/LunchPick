import { create } from 'zustand';

import { loadData, saveData } from '../lib/ipc';
import { cleanMyMenus, followRenames, toggled, withNames } from '../lib/myMenus';
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
  /** 늘 먹는 메뉴 하나를 넣거나 뺀다 (식당·메뉴는 이름으로 맞춘다) */
  toggleMyMenu: (restName: string, menuName: string) => void;
  /** 이 식당의 늘 먹는 메뉴를 통째로 바꾼다 (빈 배열이면 지운다) */
  setMyMenus: (restName: string, names: readonly string[]) => void;
  reset: () => void;
  /** 식당과 먹은 기록·늘 먹는 메뉴를 모두 지운다 (샘플 데이터도 남기지 않는다). */
  clear: () => void;
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
  myMenus: {},
  ready: false,

  init: async () => {
    let data: AppData;
    try {
      const loaded = await loadData();
      // history·myMenus 가 없는 예전 파일도 받아들인다.
      data =
        loaded && Array.isArray(loaded.restaurants)
          ? {
              restaurants: loaded.restaurants,
              history: Array.isArray(loaded.history) ? loaded.history : [],
              myMenus: cleanMyMenus(loaded.myMenus),
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
    const { restaurants, history, myMenus } = get();
    const out = fn({ restaurants, history, myMenus });
    // 식당·메뉴 이름이 바뀌거나 메뉴가 지워지면 늘 먹는 메뉴도 따라간다.
    const next: AppData = { ...out, myMenus: followRenames(restaurants, out.restaurants, out.myMenus) };
    set(next);
    scheduleSave(next);
  },

  updateRest: (id, fn) =>
    get().apply((d) => ({ ...d, restaurants: d.restaurants.map((r) => (r.id === id ? fn(r) : r)) })),

  recordEaten: (restId) =>
    get().apply((d) => ({ ...d, history: [...d.history, { restId, at: Date.now() }] })),

  toggleMyMenu: (restName, menuName) =>
    get().apply((d) => ({ ...d, myMenus: toggled(d.myMenus, restName, menuName) })),

  setMyMenus: (restName, names) =>
    get().apply((d) => ({ ...d, myMenus: withNames(d.myMenus, restName, names) })),

  reset: () => get().apply(() => seed()),

  clear: () => get().apply(() => ({ restaurants: [], history: [], myMenus: {} })),
}));

export type Menu = { id: string; name: string; price: number | null; fav: boolean };

export type Restaurant = {
  id: string;
  name: string;
  category: string;
  phone: string;
  memo: string;
  fav: boolean;
  menus: Menu[];
};

export type HistoryEntry = { restId: string; at: number };

export type AppData = { restaurants: Restaurant[]; history: HistoryEntry[] };

export type ModeId = 'elim' | 'cup' | 'ladder' | 'roulette' | 'slot' | 'ai';

export type Step = { mode: ModeId; keep: number };

/** 고르기 과정에서 후보를 나타내는 가벼운 항목. 목업의 `item(r)` 과 동일. */
export type PickItem = {
  key: string;
  restId: string;
  title: string;
  cat: string;
  sub: string;
  /** AI 추천 단계를 거친 경우에만 채워진다. */
  reason?: string;
};

export type AnimSpeed = '느리게' | '보통' | '빠르게';

export type FabrixModel = { modelId: string; label: string; servingId: string };

export type FabrixConf = {
  endpointUrl: string;
  prefixPath: string;
  modelId: string;
};

export type Settings = {
  /** 공유 서버 (이번 버전에서는 비활성 — 값만 보존한다) */
  port: string;
  name: string;
  autoStart: boolean;
  /** 표시 / 동작 */
  animSpeed: AnimSpeed;
  menuPreview: 2 | 3;
  showPrices: boolean;
  /** AI */
  fabrix: FabrixConf;
  fabrixModels: FabrixModel[];
};

export type View = 'list' | 'pick' | 'settings';

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

export type ShareMode = 'host' | 'join';

export type RecentHost = { addr: string; name: string };

export type Settings = {
  /** 같이 고르기 — 호스트로 열 때의 포트 */
  port: string;
  /** 같이 고르기에서 다른 사람에게 보일 내 이름 (아바타 색은 이름에서 정해진다) */
  name: string;
  /** 다시 접속해도 같은 사람으로 알아보기 위한 고정 id (처음 실행 때 만든다) */
  shareId: string;
  /** 앱을 켜면 공유 서버도 함께 시작 */
  autoStart: boolean;
  /** 설정 화면에서 마지막으로 고른 탭 */
  shareMode: ShareMode;
  /** 참여할 호스트 주소(주소:포트)와 최근 접속한 방 */
  joinAddr: string;
  recentHosts: RecentHost[];
  /** 표시 / 동작 */
  animSpeed: AnimSpeed;
  menuPreview: 2 | 3;
  showPrices: boolean;
  /** AI */
  fabrix: FabrixConf;
  fabrixModels: FabrixModel[];
};

export type View = 'list' | 'pick' | 'together' | 'settings';

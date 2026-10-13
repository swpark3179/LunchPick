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

/**
 * 늘 먹는 메뉴 — '이 식당이면 나는 이 메뉴'. 식당 이름(nameKey) -> 메뉴 이름들.
 * 내 PC 에만 두는 개인 데이터라 먹은 기록처럼 내보내지도, 같이 고르기로 보내지도 않는다.
 * 참여자 목록은 호스트와 id 가 달라서 이름으로 맞춘다.
 */
export type MyMenus = Record<string, string[]>;

export type AppData = { restaurants: Restaurant[]; history: HistoryEntry[]; myMenus: MyMenus };

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

/** 호스트로 열 방 — 점심 같이 고르기 / 도란식사 정하기 */
export type HostKind = 'lunch' | 'doran';

/** 한 번이라도 들어간 방 (설정의 방 찾기). at 은 마지막으로 들어간 시각 */
export type RecentHost = { addr: string; name: string; at?: number };

export type Settings = {
  /** 같이 고르기 — 호스트로 열 때의 포트 */
  port: string;
  /** 같이 고르기에서 다른 사람에게 보일 내 이름 (아바타 색은 이름에서 정해진다) */
  name: string;
  /** 다시 접속해도 같은 사람으로 알아보기 위한 고정 id (처음 실행 때 만든다) */
  shareId: string;
  /** 앱을 켜면 공유 서버도 함께 시작 */
  autoStart: boolean;
  /** 같이 고르기 — 새 채팅이 와도 작업표시줄에서 깜박이지 않는다 (부르기는 그대로 온다) */
  quiet: boolean;
  /** 설정 화면에서 마지막으로 고른 탭 */
  shareMode: ShareMode;
  /** 호스트로 열 때 마지막으로 고른 방 종류 (자동 시작은 늘 점심) */
  hostKind: HostKind;
  /** 참여할 호스트 주소(주소:포트)와 한 번이라도 들어간 방 (최근 순) */
  joinAddr: string;
  recentHosts: RecentHost[];
  /** 표시 / 동작 */
  animSpeed: AnimSpeed;
  menuPreview: 2 | 3;
  showPrices: boolean;
  /** 같이 고르기에서 확정되면 늘 먹는 메뉴를 내 메뉴로 자동으로 골라 둔다 */
  autoMyMenu: boolean;
  /** AI */
  fabrix: FabrixConf;
  fabrixModels: FabrixModel[];
};

export type View = 'list' | 'pick' | 'together' | 'settings';

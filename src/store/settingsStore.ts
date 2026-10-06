import { create } from 'zustand';

import {
  SECRET_CLIENT_KEY,
  SECRET_OPENAPI_TOKEN,
  loadSettings,
  saveSettings,
  secretExists,
} from '../lib/ipc';
import type { AnimSpeed, FabrixConf, Settings } from '../lib/types';
import { toastError } from './uiStore';

const SAVE_DEBOUNCE_MS = 400;

export const DEFAULTS: Settings = {
  port: '8787',
  name: '나',
  autoStart: false,
  animSpeed: '보통',
  menuPreview: 3,
  showPrices: true,
  fabrix: { endpointUrl: '', prefixPath: 'openapi/llm', modelId: '16' },
  fabrixModels: [],
};

/** 모델 목록을 아직 불러오지 않았을 때 보여줄 고정 옵션 (FabrixSample 의 기본/복잡 모델). */
export const FALLBACK_MODELS = [
  { modelId: '16', label: 'gpt-oss-120b(Mid) · 빠르고 저렴', servingId: 'gpt-oss-120b' },
  { modelId: '70', label: 'Glm 5.2 · 복잡한 분석', servingId: 'glm5-2-autorouter' },
];

type SettingsState = Settings & {
  ready: boolean;
  hasClientKey: boolean;
  hasOpenapiToken: boolean;
  init: () => Promise<void>;
  patch: (p: Partial<Settings>) => void;
  patchFabrix: (p: Partial<FabrixConf>) => void;
  refreshSecrets: () => Promise<void>;
};

let saveTimer: ReturnType<typeof setTimeout> | undefined;

function persistable(s: SettingsState): Settings {
  return {
    port: s.port,
    name: s.name,
    autoStart: s.autoStart,
    animSpeed: s.animSpeed,
    menuPreview: s.menuPreview,
    showPrices: s.showPrices,
    fabrix: s.fabrix,
    fabrixModels: s.fabrixModels,
  };
}

function scheduleSave(s: SettingsState) {
  clearTimeout(saveTimer);
  const snapshot = persistable(s);
  saveTimer = setTimeout(() => {
    saveSettings(snapshot).catch((e) => toastError(e, '설정 저장 실패'));
  }, SAVE_DEBOUNCE_MS);
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  ready: false,
  hasClientKey: false,
  hasOpenapiToken: false,

  init: async () => {
    let loaded: Partial<Settings> | null = null;
    try {
      loaded = await loadSettings();
    } catch (e) {
      toastError(e);
    }
    set({
      ...DEFAULTS,
      ...(loaded ?? {}),
      // 중첩 객체는 얕은 병합이 되지 않으니 직접 합친다.
      fabrix: { ...DEFAULTS.fabrix, ...(loaded?.fabrix ?? {}) },
      fabrixModels: loaded?.fabrixModels ?? [],
      ready: true,
    });
    await get().refreshSecrets();
  },

  patch: (p) => {
    set(p as Partial<SettingsState>);
    scheduleSave(get());
  },

  patchFabrix: (p) => {
    set({ fabrix: { ...get().fabrix, ...p } });
    scheduleSave(get());
  },

  refreshSecrets: async () => {
    try {
      const [hasClientKey, hasOpenapiToken] = await Promise.all([
        secretExists(SECRET_CLIENT_KEY),
        secretExists(SECRET_OPENAPI_TOKEN),
      ]);
      set({ hasClientKey, hasOpenapiToken });
    } catch (e) {
      toastError(e);
    }
  },
}));

/** 디자인의 sp() — 애니메이션 시간 배율. */
const SPEED: Record<AnimSpeed, number> = { 느리게: 1.6, 보통: 1, 빠르게: 0.55 };
export const speedMul = (s: AnimSpeed) => SPEED[s] ?? 1;

/** 설정의 표시 옵션을 컴포넌트에서 간단히 읽기 위한 훅. */
export const usePreview = () => useSettings((s) => s.menuPreview);
export const useShowPrices = () => useSettings((s) => s.showPrices);
export const useAnimSpeed = () => useSettings((s) => s.animSpeed);

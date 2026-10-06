import { create } from 'zustand';

import type { View } from '../lib/types';

const TOAST_MS = 1900;

type UiState = {
  view: View;
  toast: string | null;
  setView: (v: View) => void;
  showToast: (msg: string) => void;
};

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useUi = create<UiState>((set) => ({
  view: 'list',
  toast: null,
  setView: (view) => set({ view }),
  showToast: (toast) => {
    clearTimeout(toastTimer);
    set({ toast });
    toastTimer = setTimeout(() => set({ toast: null }), TOAST_MS);
  },
}));

/** 컴포넌트 밖(스토어/비동기 핸들러)에서 토스트를 띄울 때 쓴다. */
export const toast = (msg: string) => useUi.getState().showToast(msg);

/** Rust 커맨드 에러를 그대로 사용자에게 보여준다. */
export const toastError = (e: unknown, prefix = '') => {
  const msg = typeof e === 'string' ? e : e instanceof Error ? e.message : String(e);
  toast(prefix ? `${prefix}: ${msg}` : msg);
};

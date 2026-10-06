/**
 * Rust 커맨드 래퍼. 타입은 src-tauri/src/*.rs 의 시그니처와 1:1로 맞춘다.
 *
 * Tauri 없이 `npm run dev` 만 띄워 UI 를 보는 경우를 대비해 저장 계층은
 * localStorage 로 폴백한다 (AI 는 폴백 없이 실패 — 프론트에서 무작위로 처리한다).
 */
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';

import type { AppData, FabrixConf, FabrixModel, Settings } from './types';

export const SECRET_CLIENT_KEY = 'fabrix_client_key';
export const SECRET_OPENAPI_TOKEN = 'fabrix_openapi_token';
export const ERR_NO_CREDS = 'NO_CREDENTIALS';

export const hasTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

type FileFilter = { name: string; extensions: string[] };

// ---------------------------------------------------------------- 저장

const LS_DATA = 'lunchpick.dev.data';
const LS_SETTINGS = 'lunchpick.dev.settings';

function lsRead<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function lsWrite(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 저장 공간이 없어도 앱은 계속 동작해야 한다 */
  }
}

export async function loadData(): Promise<AppData | null> {
  if (!hasTauri) return lsRead<AppData>(LS_DATA);
  return invoke<AppData | null>('load_data');
}

export async function saveData(data: AppData): Promise<void> {
  if (!hasTauri) return lsWrite(LS_DATA, data);
  return invoke<void>('save_data', { data });
}

export async function loadSettings(): Promise<Partial<Settings> | null> {
  if (!hasTauri) return lsRead<Partial<Settings>>(LS_SETTINGS);
  return invoke<Partial<Settings> | null>('load_settings');
}

export async function saveSettings(settings: Settings): Promise<void> {
  if (!hasTauri) return lsWrite(LS_SETTINGS, settings);
  return invoke<void>('save_settings', { settings });
}

export const readTextFile = (path: string) => invoke<string>('read_text_file', { path });

export const writeTextFile = (path: string, contents: string) =>
  invoke<void>('write_text_file', { path, contents });

export async function dataDirPath(): Promise<string> {
  if (!hasTauri) return '(개발 모드 · 브라우저 localStorage)';
  return invoke<string>('data_dir_path');
}

// ---------------------------------------------------------------- 비밀값
// 읽기 커맨드는 의도적으로 없다. 키는 Rust 안에서만 읽힌다.

const devSecrets = new Set<string>();

export async function secretSet(key: string, value: string): Promise<void> {
  if (!hasTauri) {
    devSecrets.add(key);
    return;
  }
  return invoke<void>('secret_set', { key, value });
}

export async function secretDelete(key: string): Promise<void> {
  if (!hasTauri) {
    devSecrets.delete(key);
    return;
  }
  return invoke<void>('secret_delete', { key });
}

export async function secretExists(key: string): Promise<boolean> {
  if (!hasTauri) return devSecrets.has(key);
  return invoke<boolean>('secret_exists', { key });
}

// ---------------------------------------------------------------- FabriX

export type AiPick = { no: number; reason: string };

export const fabrixModels = (conf: FabrixConf) => invoke<FabrixModel[]>('fabrix_models', { conf });

export const fabrixTest = (conf: FabrixConf) => invoke<string>('fabrix_test', { conf });

export const fabrixRecommend = (conf: FabrixConf, prompt: string) =>
  invoke<AiPick[]>('fabrix_recommend', { conf, prompt });

export type ChatTurn = { role: 'system' | 'user' | 'assistant'; content: string };

/** 같이 고르기의 멀티턴 AI 정렬. 답변 본문(JSON 텍스트)을 그대로 받는다. */
export const fabrixChat = (conf: FabrixConf, messages: ChatTurn[]) =>
  invoke<string>('fabrix_chat', { conf, messages });

// ---------------------------------------------------------------- 창 / 클립보드 / 다이얼로그

export async function copyText(text: string): Promise<void> {
  if (hasTauri) return writeText(text);
  await navigator.clipboard.writeText(text);
}

export async function pickOpenPath(filters: FileFilter[]): Promise<string | null> {
  const res = await openDialog({ multiple: false, directory: false, filters });
  return typeof res === 'string' ? res : null;
}

export async function pickSavePath(defaultPath: string, filters: FileFilter[]): Promise<string | null> {
  const res = await saveDialog({ defaultPath, filters });
  return res ?? null;
}

export const windowMinimize = () => (hasTauri ? getCurrentWindow().minimize() : Promise.resolve());
export const windowToggleMaximize = () =>
  hasTauri ? getCurrentWindow().toggleMaximize() : Promise.resolve();
export const windowClose = () => (hasTauri ? getCurrentWindow().close() : Promise.resolve());
export const windowShow = () => (hasTauri ? getCurrentWindow().show() : Promise.resolve());

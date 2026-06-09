import { WebviewWindow, getAllWebviewWindows } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { WorkspaceId } from '@goodboy/types';

export const MAIN_WINDOW_LABEL = 'main';
const WORKSPACE_HASH_KEY = 'ws';
const PRESENCE_EVENT = 'goodboy:presence';
const PRESENCE_REQUEST_EVENT = 'goodboy:presence-request';
const WINDOW_CLOSING_EVENT = 'goodboy:window-closing';

export type PresencePayload = {
  readonly label: string;
  readonly workspaceId: WorkspaceId | null;
};

function inTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export const currentWindowLabel = (): string => {
  if (!inTauri()) {
    return MAIN_WINDOW_LABEL;
  }
  return getCurrentWindow().label;
};

export const isMainWindow = (): boolean => {
  return currentWindowLabel() === MAIN_WINDOW_LABEL;
};

export const targetWorkspaceFromHash = (): WorkspaceId | null => {
  const raw = globalThis.location?.hash ?? '';
  const params = new URLSearchParams(raw.replace(/^#/, ''));
  const id = params.get(WORKSPACE_HASH_KEY);
  return id ? (id as WorkspaceId) : null;
};

export const focusWindow = async (label: string): Promise<boolean> => {
  if (!inTauri()) {
    return false;
  }
  const windows = await getAllWebviewWindows();
  const target = windows.find((w) => w.label === label);
  if (!target) {
    return false;
  }
  await target.unminimize().catch(() => undefined);
  await target.setFocus();
  return true;
};

function freshWindowLabel(): string {
  const raw = globalThis.crypto?.randomUUID?.() ?? `${performance.now()}`;
  return `win-${raw.replace(/[^a-z0-9]/gi, '').slice(0, 16)}`;
}

export const spawnWorkspaceWindow = async (id: WorkspaceId, title: string): Promise<void> => {
  if (!inTauri()) {
    return;
  }
  const win = new WebviewWindow(freshWindowLabel(), {
    url: `index.html#${WORKSPACE_HASH_KEY}=${id}`,
    title,
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
  });
  await new Promise<void>((resolve, reject) => {
    void win.once('tauri://created', () => resolve());
    void win.once('tauri://error', (event) => reject(new Error(String(event.payload))));
  });
};

export const setWindowTitle = async (title: string): Promise<void> => {
  if (!inTauri()) {
    return;
  }
  await getCurrentWindow()
    .setTitle(`${title} · Goodboy`)
    .catch(() => undefined);
};

export const announcePresence = (workspaceId: WorkspaceId | null): Promise<void> => {
  if (!inTauri()) {
    return Promise.resolve();
  }
  return emit(PRESENCE_EVENT, { label: currentWindowLabel(), workspaceId });
};

export const requestPresence = (): Promise<void> => {
  if (!inTauri()) {
    return Promise.resolve();
  }
  return emit(PRESENCE_REQUEST_EVENT, {});
};

export const notifyWindowClosing = (): Promise<void> => {
  if (!inTauri()) {
    return Promise.resolve();
  }
  return emit(WINDOW_CLOSING_EVENT, { label: currentWindowLabel() });
};

export type PresenceHandlers = {
  readonly onPresence: (payload: PresencePayload) => void;
  readonly onRequest: () => void;
  readonly onClosing: (label: string) => void;
};

export const listenPresence = async (handlers: PresenceHandlers): Promise<UnlistenFn> => {
  if (!inTauri()) {
    return () => undefined;
  }
  const offs = await Promise.all([
    listen<PresencePayload>(PRESENCE_EVENT, (event) => handlers.onPresence(event.payload)),
    listen(PRESENCE_REQUEST_EVENT, () => handlers.onRequest()),
    listen<{ label: string }>(WINDOW_CLOSING_EVENT, (event) =>
      handlers.onClosing(event.payload.label),
    ),
  ]);
  return () => {
    for (const off of offs) off();
  };
};

export const onWindowClose = async (callback: () => void): Promise<UnlistenFn> => {
  if (!inTauri()) {
    return () => undefined;
  }
  return getCurrentWindow().onCloseRequested(() => callback());
};

import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isTauriRuntime } from '../isTauriRuntime';

const DATA_CHANGED_EVENT = 'goodboy:data-changed';

const ORIGIN = globalThis.crypto?.randomUUID?.() ?? `window-${Math.random().toString(36).slice(2)}`;

type DataChange = {
  readonly kind: 'setting';
  readonly key: string;
};

type Announcement = DataChange & {
  readonly origin: string;
};

type AnnounceParams = {
  readonly change: DataChange;
};

type ListenParams = {
  readonly onChange: (change: DataChange) => void;
};

export const announceDataChanged = ({ change }: AnnounceParams): Promise<void> => {
  if (!isTauriRuntime()) {
    return Promise.resolve();
  }
  const announcement: Announcement = { ...change, origin: ORIGIN };
  return emit(DATA_CHANGED_EVENT, announcement);
};

export const listenDataChanged = async ({ onChange }: ListenParams): Promise<UnlistenFn> => {
  if (!isTauriRuntime()) {
    return () => undefined;
  }
  return listen<Announcement>(DATA_CHANGED_EVENT, (event) => {
    const { origin, ...change } = event.payload;
    if (origin === ORIGIN) {
      return;
    }
    onChange(change);
  });
};

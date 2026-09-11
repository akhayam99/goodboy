import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { PrLifecycleAction } from './prLifecycle';

const PR_WRITE_EVENT = 'goodboy:pr-write';

export type PrWriteAnnouncement = {
  readonly kind: 'claimed' | 'released';
  readonly key: string;
  readonly token: string;
  readonly windowLabel: string;
  readonly action: PrLifecycleAction;
  readonly startedAt: number;
};

const inTauri = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const announcePrWrite = async (announcement: PrWriteAnnouncement): Promise<void> => {
  if (!inTauri()) {
    return;
  }
  await emit(PR_WRITE_EVENT, announcement).catch(() => undefined);
};

export const listenPrWrites = async (
  onAnnouncement: (announcement: PrWriteAnnouncement) => void,
): Promise<UnlistenFn> => {
  if (!inTauri()) {
    return () => undefined;
  }
  return listen<PrWriteAnnouncement>(PR_WRITE_EVENT, (event) => onAnnouncement(event.payload));
};

import type { GetFn } from './types';

export const STORAGE_CHECK_DELAY_MS = 90_000;

type Params = {
  readonly get: GetFn;
  readonly delayMs?: number;
};

export const scheduleStorageCheck = ({ get, delayMs = STORAGE_CHECK_DELAY_MS }: Params): void => {
  setTimeout(() => {
    if (!get().hydrated) {
      return;
    }
    void get()
      .loadStorage()
      .catch(() => undefined);
  }, delayMs);
};

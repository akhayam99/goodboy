import type { GetFn } from './types';

export const SEARCH_BACKFILL_DELAY_MS = 5_000;

type Params = {
  readonly get: GetFn;
  readonly delayMs?: number;
};

export const scheduleSearchBackfill = ({
  get,
  delayMs = SEARCH_BACKFILL_DELAY_MS,
}: Params): void => {
  setTimeout(() => {
    if (!get().hydrated) {
      return;
    }
    void get()
      .backfillSearchIndex()
      .catch(() => undefined);
  }, delayMs);
};

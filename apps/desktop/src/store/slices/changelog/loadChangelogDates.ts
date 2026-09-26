import { readChangelogDatesCache } from './cache';
import type { GetFn, SetFn } from './types';

export const loadChangelogDates = (set: SetFn, get: GetFn) => {
  return async (): Promise<void> => {
    const { changelogDatesStatus } = get();
    if (changelogDatesStatus === 'loading' || changelogDatesStatus === 'ready') {
      return;
    }
    const cached = readChangelogDatesCache();
    if (cached !== null) {
      set({ changelogDates: cached.dates, changelogDatesFetchedAt: cached.fetchedAt });
    }
    await get().reloadChangelogDates();
  };
};

import { readChangelogCache } from './cache';
import type { GetFn, SetFn } from './types';

export const loadChangelog = (set: SetFn, get: GetFn) => {
  return async (): Promise<void> => {
    const { changelogStatus, changelogReleases } = get();
    if (changelogStatus === 'loading' || changelogStatus === 'ready') {
      return;
    }
    if (changelogReleases.length === 0) {
      const cached = readChangelogCache();
      if (cached != null && cached.releases.length > 0) {
        set({ changelogReleases: cached.releases, changelogFetchedAt: cached.fetchedAt });
      }
    }
    await get().reloadChangelog();
  };
};

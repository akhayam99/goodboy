import { fetchReleases } from '../../../features/changelog/changelog';
import { formatError } from '../../../shared/lib/errors';
import { writeChangelogCache } from './cache';
import type { GetFn, SetFn } from './types';

export const reloadChangelog = (set: SetFn, _get: GetFn) => {
  return async (): Promise<void> => {
    set({ changelogStatus: 'loading', changelogError: null });
    try {
      const releases = await fetchReleases();
      const fetchedAt = new Date().toISOString();
      writeChangelogCache({ fetchedAt, releases });
      set({
        changelogReleases: releases,
        changelogStatus: 'ready',
        changelogError: null,
        changelogFetchedAt: fetchedAt,
      });
    } catch (err) {
      set({ changelogStatus: 'error', changelogError: formatError(err) });
    }
  };
};

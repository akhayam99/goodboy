import { fetchReleases } from '../../../features/changelog/changelog';
import { writeChangelogDatesCache } from './cache';
import type { GetFn, SetFn } from './types';

const versionOf = ({ tag }: { readonly tag: string }): string => tag.trim().replace(/^v/i, '');

export const reloadChangelogDates = (set: SetFn, _get: GetFn) => {
  return async (): Promise<void> => {
    set({ changelogDatesStatus: 'loading' });
    try {
      const releases = await fetchReleases();
      const dates: Record<string, string> = {};
      releases.forEach((release) => {
        dates[versionOf({ tag: release.version })] = release.publishedAt;
      });
      const fetchedAt = new Date().toISOString();
      writeChangelogDatesCache({ fetchedAt, dates });
      set({
        changelogDates: dates,
        changelogDatesStatus: 'ready',
        changelogDatesFetchedAt: fetchedAt,
      });
    } catch {
      set({ changelogDatesStatus: 'error' });
    }
  };
};

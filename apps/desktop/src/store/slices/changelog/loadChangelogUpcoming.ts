import { getVersion } from '@tauri-apps/api/app';
import { fetchReleaseChangelog } from '../../../features/changelog/fetchReleaseChangelog';
import { releasesInUpdate } from '../../../features/changelog/upcomingReleases';
import type { GetFn, SetFn } from './types';

export type LoadChangelogUpcomingParams = {
  readonly target: string;
};

const inFlight = new Set<string>();

export const loadChangelogUpcoming = (set: SetFn, get: GetFn) => {
  return async ({ target }: LoadChangelogUpcomingParams): Promise<void> => {
    const version = target.trim().replace(/^v/i, '');
    if (get().changelogUpcoming?.target === version || inFlight.has(version)) {
      return;
    }
    inFlight.add(version);
    try {
      const installed = await getVersion();
      const text = await fetchReleaseChangelog({ version });
      set({
        changelogUpcoming: {
          target: version,
          releases: releasesInUpdate({ text, installed, target: version }),
        },
      });
    } catch {
      return;
    } finally {
      inFlight.delete(version);
    }
  };
};

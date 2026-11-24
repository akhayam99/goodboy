import { getSetting } from '@goodboy/db';
import { loadBundledReleases } from '../../../features/changelog/loadBundledReleases';
import { tauriDatabase } from '../../../shared/lib/db';
import { SETTING_CHANGELOG_SEEN } from './state';
import type { GetFn, SetFn } from './types';

export const hydrateChangelogSeen = (set: SetFn, _get: GetFn) => {
  return async (): Promise<void> => {
    try {
      const [releases, stored] = await Promise.all([
        loadBundledReleases(),
        getSetting(tauriDatabase, SETTING_CHANGELOG_SEEN),
      ]);
      set({
        changelogReleases: releases,
        changelogSeenVersion: stored != null && stored !== '' ? stored : null,
        changelogSeenHydrated: true,
      });
    } catch {
      set({ changelogSeenVersion: null, changelogSeenHydrated: true });
    }
  };
};

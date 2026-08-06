import { getSetting } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { SETTING_CHANGELOG_SEEN } from './state';
import type { GetFn, SetFn } from './types';

export const hydrateChangelogSeen = (set: SetFn, _get: GetFn) => {
  return async (): Promise<void> => {
    try {
      const stored = await getSetting(tauriDatabase, SETTING_CHANGELOG_SEEN);
      set({ changelogSeenVersion: stored != null && stored !== '' ? stored : null });
    } catch {
      set({ changelogSeenVersion: null });
    }
  };
};

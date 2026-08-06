import { setSetting } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { SETTING_CHANGELOG_SEEN } from './state';
import type { GetFn, SetFn } from './types';

export type Params = {
  readonly version: string;
};

export const markChangelogSeen = (set: SetFn, get: GetFn) => {
  return async ({ version }: Params): Promise<void> => {
    const next = version.trim();
    if (next === '' || get().changelogSeenVersion === next) {
      return;
    }
    set({ changelogSeenVersion: next });
    try {
      await setSetting(tauriDatabase, SETTING_CHANGELOG_SEEN, next);
    } catch {
      return;
    }
  };
};

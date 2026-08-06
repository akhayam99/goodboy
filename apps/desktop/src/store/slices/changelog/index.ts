import { hydrateChangelogSeen } from './hydrateChangelogSeen';
import { loadChangelog } from './loadChangelog';
import { markChangelogSeen } from './markChangelogSeen';
import { reloadChangelog } from './reloadChangelog';
import type { GetFn, SetFn } from './types';

export const createChangelogSlice = (set: SetFn, get: GetFn) => {
  return {
    loadChangelog: loadChangelog(set, get),
    reloadChangelog: reloadChangelog(set, get),
    hydrateChangelogSeen: hydrateChangelogSeen(set, get),
    markChangelogSeen: markChangelogSeen(set, get),
  };
};

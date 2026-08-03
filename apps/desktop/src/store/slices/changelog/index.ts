import { loadChangelog } from './loadChangelog';
import { reloadChangelog } from './reloadChangelog';
import type { GetFn, SetFn } from './types';

export const createChangelogSlice = (set: SetFn, get: GetFn) => {
  return {
    loadChangelog: loadChangelog(set, get),
    reloadChangelog: reloadChangelog(set, get),
  };
};

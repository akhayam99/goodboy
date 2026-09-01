import { loadStorageStats } from './loadStorageStats';
import { pruneArchivedTranscripts } from './pruneArchivedTranscripts';
import { removeArchivedWorktrees } from './removeArchivedWorktrees';
import type { GetFn, SetFn } from './types';

export type { StorageStats } from './types';

export const createStorageSlice = (set: SetFn, get: GetFn) => {
  return {
    loadStorageStats: loadStorageStats(set, get),
    pruneArchivedTranscripts: pruneArchivedTranscripts(set, get),
    removeArchivedWorktrees: removeArchivedWorktrees(set, get),
  };
};

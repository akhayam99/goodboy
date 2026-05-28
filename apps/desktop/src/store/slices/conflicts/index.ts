import { resolveMergeConflicts } from './resolveMergeConflicts';
import { setSessionMergeConflicts } from './setSessionMergeConflicts';
import type { GetFn, SetFn } from './types';

export function createConflictsSlice(set: SetFn, get: GetFn) {
  return {
    setSessionMergeConflicts: setSessionMergeConflicts(set),
    resolveMergeConflicts: resolveMergeConflicts(set, get),
  };
}

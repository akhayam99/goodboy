import { loadDeletedBranches } from './loadDeletedBranches';
import { restoreDeletedBranch } from './restoreDeletedBranch';
import { runAfterMergeCleanup } from './runAfterMergeCleanup';
import { branchCleanupInitialState } from './state';
import type { BranchCleanupSlice, GetFn, SetFn } from './types';

export type { AfterMergeOutcome } from './types';
export { resolveAfterMergeRule, DEFAULT_AFTER_MERGE_RULE } from './resolveAfterMergeRule';

export const createBranchCleanupSlice = (set: SetFn, get: GetFn): BranchCleanupSlice => ({
  ...branchCleanupInitialState,
  runAfterMergeCleanup: runAfterMergeCleanup(set, get),
  restoreDeletedBranch: restoreDeletedBranch(set, get),
  loadDeletedBranches: loadDeletedBranches(set),
});

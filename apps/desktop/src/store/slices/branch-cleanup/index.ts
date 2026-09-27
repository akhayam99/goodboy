import { deleteBranches, restoreDeletedBranches } from './deleteBranches';
import { loadDeletedBranches } from './loadDeletedBranches';
import { loadProjectBranches } from './loadProjectBranches';
import { restoreDeletedBranch } from './restoreDeletedBranch';
import { runAfterMergeCleanup } from './runAfterMergeCleanup';
import { branchCleanupInitialState } from './state';
import type { BranchCleanupSlice, GetFn, SetFn } from './types';

export type { BranchScanEntry } from './state';
export { DEFAULT_AFTER_MERGE_RULE } from './resolveAfterMergeRule';

export const createBranchCleanupSlice = (set: SetFn, get: GetFn): BranchCleanupSlice => ({
  ...branchCleanupInitialState,
  runAfterMergeCleanup: runAfterMergeCleanup(set, get),
  restoreDeletedBranch: restoreDeletedBranch(set, get),
  loadDeletedBranches: loadDeletedBranches(set),
  loadProjectBranches: loadProjectBranches(set, get),
  deleteBranches: deleteBranches(set, get),
  restoreDeletedBranches: restoreDeletedBranches(set, get),
});

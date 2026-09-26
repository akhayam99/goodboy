import type { DeletedBranch, MountId, SessionId, WorkspaceId } from '@goodboy/types';
import type { BranchCleanupState } from './state';

export type { GetFn, SetFn } from '../../slice-types';

export type RunAfterMergeCleanupParams = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly expectedBranch: string;
};

export type AfterMergeOutcome =
  | { readonly kind: 'ask'; readonly keptBecause: string | null }
  | { readonly kind: 'deleted'; readonly deleted: DeletedBranch }
  | { readonly kind: 'kept'; readonly keptBecause: string }
  | { readonly kind: 'skipped' };

export type RestoreDeletedBranchParams = {
  readonly id: string;
};

export type LoadDeletedBranchesParams = {
  readonly workspaceId: WorkspaceId;
};

export type BranchCleanupSlice = BranchCleanupState & {
  runAfterMergeCleanup(params: RunAfterMergeCleanupParams): Promise<AfterMergeOutcome>;
  restoreDeletedBranch(params: RestoreDeletedBranchParams): Promise<void>;
  loadDeletedBranches(params: LoadDeletedBranchesParams): Promise<void>;
};

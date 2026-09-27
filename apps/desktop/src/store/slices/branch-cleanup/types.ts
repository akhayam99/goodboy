import type { DeletedBranch, MountId, ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import type { BranchCleanupState } from './state';

export type { GetFn, SetFn } from '../../slice-types';

export type RunAfterMergeCleanupParams = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly expectedBranch: string;
  readonly mergedHeadSha?: string | null;
};

export type CheckMergedThenParams = {
  readonly mountId: MountId;
  readonly repoRoot: string;
  readonly branch: string;
  readonly baseBranch: string | null;
  readonly head: string;
  readonly mergedHead: string;
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

export type LoadProjectBranchesParams = {
  readonly projectIds: ReadonlyArray<ProjectId>;
};

type DeleteBranchTarget = {
  readonly projectId: ProjectId;
  readonly branch: string;
  readonly sha: string;
  readonly sessionId: SessionId | null;
  readonly alsoOrigin: boolean;
};

export type DeleteBranchesParams = {
  readonly targets: ReadonlyArray<DeleteBranchTarget>;
};

export type DeleteBranchesOutcome = {
  readonly deleted: ReadonlyArray<DeletedBranch>;
  readonly kept: ReadonlyArray<string>;
};

export type RestoreDeletedBranchesParams = {
  readonly ids: ReadonlyArray<string>;
};

export type BranchCleanupSlice = BranchCleanupState & {
  runAfterMergeCleanup(params: RunAfterMergeCleanupParams): Promise<AfterMergeOutcome>;
  restoreDeletedBranch(params: RestoreDeletedBranchParams): Promise<void>;
  loadDeletedBranches(params: LoadDeletedBranchesParams): Promise<void>;
  loadProjectBranches(params: LoadProjectBranchesParams): Promise<void>;
  deleteBranches(params: DeleteBranchesParams): Promise<DeleteBranchesOutcome>;
  restoreDeletedBranches(params: RestoreDeletedBranchesParams): Promise<void>;
  checkMergedThen(params: CheckMergedThenParams): Promise<void>;
};

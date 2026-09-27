import type { GoodboyBranch } from '@goodboy/db';
import type { DeletedBranch, ProjectId, WorkspaceId } from '@goodboy/types';
import type { ProjectBranchScan } from '../../../features/worktree/branchCleanup';

export type BranchScanEntry =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready';
      readonly scan: ProjectBranchScan;
      readonly goodboy: ReadonlyArray<GoodboyBranch>;
    }
  | { readonly status: 'failed'; readonly message: string };

export type BranchCleanupState = {
  readonly deletedBranches: Readonly<Record<WorkspaceId, ReadonlyArray<DeletedBranch>>>;
  readonly branchScans: Readonly<Record<ProjectId, BranchScanEntry>>;
};

export const branchCleanupInitialState: BranchCleanupState = {
  deletedBranches: {},
  branchScans: {},
};

import type { GoodboyBranch } from '@goodboy/db';
import type { DeletedBranch, MountId, ProjectId, WorkspaceId } from '@goodboy/types';
import type { ProjectBranchScan } from '../../../features/worktree/branchCleanup';

export type BranchScanEntry =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready';
      readonly scan: ProjectBranchScan;
      readonly goodboy: ReadonlyArray<GoodboyBranch>;
    }
  | { readonly status: 'failed'; readonly message: string };

type MergedThenEntry = {
  readonly head: string;
  readonly mergedHead: string;
  readonly newCommits: number;
};

export type BranchCleanupState = {
  readonly deletedBranches: Readonly<Record<WorkspaceId, ReadonlyArray<DeletedBranch>>>;
  readonly branchScans: Readonly<Record<ProjectId, BranchScanEntry>>;
  readonly mergedThen: Readonly<Record<MountId, MergedThenEntry>>;
};

export const branchCleanupInitialState: BranchCleanupState = {
  deletedBranches: {},
  branchScans: {},
  mergedThen: {},
};

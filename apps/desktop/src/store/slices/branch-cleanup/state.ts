import type { DeletedBranch, WorkspaceId } from '@goodboy/types';

export type BranchCleanupState = {
  readonly deletedBranches: Readonly<Record<WorkspaceId, ReadonlyArray<DeletedBranch>>>;
};

export const branchCleanupInitialState: BranchCleanupState = {
  deletedBranches: {},
};

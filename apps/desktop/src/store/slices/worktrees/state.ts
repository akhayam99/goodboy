import type { OrphanWorktree } from '../../../features/worktree/worktree';

export type WorktreesState = {
  readonly orphanWorktrees: Readonly<Record<string, ReadonlyArray<OrphanWorktree>>>;
};

export const worktreesInitialState: WorktreesState = {
  orphanWorktrees: {},
};

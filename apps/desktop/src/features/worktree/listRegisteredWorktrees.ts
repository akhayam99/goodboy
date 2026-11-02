import type { WorktreeInspection } from '@goodboy/types';
import { invokeCommand } from '../../shared/lib/invokeCommand';

type Params = {
  readonly repoPath: string;
  readonly worktreePaths: ReadonlyArray<string>;
};

export const listRegisteredWorktrees = async ({
  repoPath,
  worktreePaths,
}: Params): Promise<ReadonlyArray<WorktreeInspection>> => {
  return invokeCommand<ReadonlyArray<WorktreeInspection>>('worktree_list_registered', {
    repoPath,
    worktreePaths,
  });
};

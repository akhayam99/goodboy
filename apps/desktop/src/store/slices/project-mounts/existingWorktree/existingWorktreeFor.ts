import { worktreeBranchHolder, type CreatedWorktree } from '../../../../features/worktree/worktree';
import { branchLeaf } from '../../sessions/branchLeaf';

type Params = {
  readonly repoPath: string;
  readonly branch: string;
  readonly worktreePath: string;
};

export const existingWorktreeFor = async ({
  repoPath,
  branch,
  worktreePath,
}: Params): Promise<CreatedWorktree> => {
  const holder = await worktreeBranchHolder({ repoPath, branch });
  if (holder !== worktreePath) {
    throw new Error(`${branch} is no longer checked out at ${worktreePath}`);
  }
  return { worktreePath, branchName: branch, slug: branchLeaf({ branch }), reused: true };
};

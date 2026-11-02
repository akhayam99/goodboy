import { invokeCommand } from '../../shared/lib/invokeCommand';

type Params = {
  readonly worktreePath: string;
  readonly baseBranch: string | null;
  readonly path: string;
  readonly oldPath: string | null;
};

export const worktreeDiffBody = ({
  worktreePath,
  baseBranch,
  path,
  oldPath,
}: Params): Promise<string> =>
  invokeCommand<string>('worktree_diff_file', {
    worktreePath,
    baseBranch,
    path,
    ...(oldPath !== null && { oldPath }),
  });

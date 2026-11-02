import { invokeCommand } from '../../shared/lib/invokeCommand';
import type { DiffFileEntry } from './diffFileEntry';

type Params = {
  readonly worktreePath: string;
  readonly baseBranch: string | null;
};

export const worktreeDiffFiles = ({
  worktreePath,
  baseBranch,
}: Params): Promise<ReadonlyArray<DiffFileEntry>> =>
  invokeCommand<ReadonlyArray<DiffFileEntry>>('worktree_diff_files', { worktreePath, baseBranch });

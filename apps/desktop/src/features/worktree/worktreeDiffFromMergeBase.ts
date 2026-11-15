import { invokeCommand } from '../../shared/lib/invokeCommand';

export type DiffFromMergeBaseParams = {
  readonly worktreePath: string;
  readonly base: string;
  readonly head: string;
};

export const worktreeDiffFromMergeBase = ({
  worktreePath,
  base,
  head,
}: DiffFromMergeBaseParams): Promise<string> =>
  invokeCommand<string>('worktree_diff_range', {
    worktreePath,
    base,
    head,
    isFromMergeBase: true,
  });

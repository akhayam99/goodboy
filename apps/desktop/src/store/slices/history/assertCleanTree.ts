import { ensure, worktreeStatusKey } from '../worktreeStatuses/cache';
import { changedCount } from '../../../shared/lib/gitStatus';
import { DirtyTreeError } from './DirtyTreeError';
import { TreeUnreadableError } from './TreeUnreadableError';

type Params = {
  readonly worktreePath: string;
  readonly baseBranch: string | null;
};

export const assertCleanTree = async ({ worktreePath, baseBranch }: Params): Promise<void> => {
  const status = await ensure({
    key: worktreeStatusKey({ worktreePath, baseBranch: baseBranch ?? undefined }),
    worktreePath,
    baseBranch: baseBranch ?? undefined,
    maxAgeMs: 0,
  });
  const count = status === null ? null : changedCount({ workingTree: status.workingTree });
  if (count === null) {
    throw new TreeUnreadableError();
  }
  if (count === 0) {
    return;
  }
  throw new DirtyTreeError({ count });
};

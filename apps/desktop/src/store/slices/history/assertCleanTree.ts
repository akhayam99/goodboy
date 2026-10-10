import { ensure, worktreeStatusKey } from '../worktreeStatuses/cache';
import { changedCount } from '../../../shared/lib/gitStatus';
import { DirtyTreeError } from './DirtyTreeError';

type Params = {
  readonly worktreePath: string;
  readonly baseBranch: string | null;
};

const PREFLIGHT_MAX_AGE_MS = 2_000;

export const assertCleanTree = async ({ worktreePath, baseBranch }: Params): Promise<void> => {
  const status = await ensure({
    key: worktreeStatusKey({ worktreePath, baseBranch: baseBranch ?? undefined }),
    worktreePath,
    baseBranch: baseBranch ?? undefined,
    maxAgeMs: PREFLIGHT_MAX_AGE_MS,
  });
  const count = status === null ? null : changedCount({ workingTree: status.workingTree });
  if (count === null || count === 0) {
    return;
  }
  throw new DirtyTreeError({ count });
};

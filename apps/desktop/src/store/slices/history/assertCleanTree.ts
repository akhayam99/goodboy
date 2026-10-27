import { ensure, worktreeStatusKey } from '../../runtime/worktreeStatuses/cache';
import { changedCount } from '../../../shared/lib/gitStatus';
import { DirtyTreeError } from './DirtyTreeError';
import { TreeUnreadableError } from './TreeUnreadableError';

type Params = {
  readonly worktreePath: string;
  readonly baseBranch: string | null;
  readonly canCarryDirty?: boolean;
};

export const assertCleanTree = async ({
  worktreePath,
  baseBranch,
  canCarryDirty = false,
}: Params): Promise<void> => {
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
  if (status !== null && status.inProgress !== undefined && status.inProgress !== null) {
    throw new Error(`A git ${status.inProgress} is in progress. Finish or abort it first.`);
  }
  if (
    count === 0 ||
    (canCarryDirty && status?.workingTree.kind === 'known' && status.workingTree.unmerged === 0)
  ) {
    return;
  }
  throw new DirtyTreeError({ count });
};

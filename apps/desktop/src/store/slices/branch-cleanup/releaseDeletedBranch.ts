import { forgetDeletedBranch } from '@goodboy/db';
import type { DeletedBranch } from '@goodboy/types';
import { forgetDeletedBranchRef } from '../../../features/worktree/branchCleanup';
import { tauriDatabase } from '../../../shared/lib/db';

type Params = {
  readonly entry: DeletedBranch;
};

export const releaseDeletedBranch = async ({ entry }: Params): Promise<void> => {
  await forgetDeletedBranchRef({
    repoRoot: entry.repoRoot,
    keepRef: entry.keepRef,
    sha: entry.sha,
  });
  await forgetDeletedBranch({ db: tauriDatabase, id: entry.id });
};

import { forgetDeletedBranch, listDeletedBranches, listExpiredDeletedBranches } from '@goodboy/db';
import { DELETED_BRANCH_KEEP_DAYS } from '@goodboy/types';
import type { IsoDateTime } from '@goodboy/types';
import { forgetDeletedBranchRef } from '../../../features/worktree/branchCleanup';
import { tauriDatabase } from '../../../shared/lib/db';
import type { LoadDeletedBranchesParams, SetFn } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

const pruneExpiredDeletedBranches = async ({
  now = Date.now(),
}: {
  readonly now?: number;
} = {}): Promise<void> => {
  const before = new Date(now - DELETED_BRANCH_KEEP_DAYS * DAY_MS).toISOString() as IsoDateTime;
  const expired = await listExpiredDeletedBranches({ db: tauriDatabase, before });
  for (const entry of expired) {
    const released = await forgetDeletedBranchRef({
      repoRoot: entry.repoRoot,
      keepRef: entry.keepRef,
      sha: entry.sha,
    })
      .then(() => true)
      .catch(() => false);
    if (released) {
      await forgetDeletedBranch({ db: tauriDatabase, id: entry.id });
    }
  }
};

export const loadDeletedBranches = (set: SetFn) => {
  return async ({ workspaceId }: LoadDeletedBranchesParams): Promise<void> => {
    await pruneExpiredDeletedBranches().catch(() => undefined);
    const entries = await listDeletedBranches({ db: tauriDatabase, workspaceId });
    set((state) => ({
      deletedBranches: { ...state.deletedBranches, [workspaceId]: entries },
    }));
  };
};

import { listDeletedBranches, listExpiredDeletedBranches } from '@goodboy/db';
import { DELETED_BRANCH_KEEP_DAYS } from '@goodboy/types';
import type { IsoDateTime } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { releaseDeletedBranch } from './releaseDeletedBranch';
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
    await releaseDeletedBranch({ entry }).catch(() => undefined);
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

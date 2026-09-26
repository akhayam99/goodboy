import { getDeletedBranch, markDeletedBranchRestored } from '@goodboy/db';
import type { DeletedBranch, IsoDateTime } from '@goodboy/types';
import { restoreDeletedBranch as restoreBranchRef } from '../../../features/worktree/branchCleanup';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, RestoreDeletedBranchParams, SetFn } from './types';

export const restoreDeletedBranch = (set: SetFn, get: GetFn) => {
  return async ({ id }: RestoreDeletedBranchParams): Promise<void> => {
    const entry = await getDeletedBranch({ db: tauriDatabase, id });
    if (entry === null || entry.restoredAt !== null) {
      return;
    }
    await restoreBranchRef({
      repoRoot: entry.repoRoot,
      branch: entry.branch,
      sha: entry.sha,
      keepRef: entry.keepRef,
      pushToOrigin: entry.onOrigin,
    });
    const restoredAt = new Date().toISOString() as IsoDateTime;
    await markDeletedBranchRestored({ db: tauriDatabase, id, restoredAt });
    const restored: DeletedBranch = { ...entry, restoredAt };
    set((state) => ({
      deletedBranches: {
        ...state.deletedBranches,
        [entry.workspaceId]: (state.deletedBranches[entry.workspaceId] ?? []).map((candidate) =>
          candidate.id === id ? restored : candidate,
        ),
      },
    }));
    if (entry.sessionId === null) {
      return;
    }
    await get().recordSessionEvent({
      sessionId: entry.sessionId,
      kind: 'branch_restored',
      payload: { branch: entry.branch, projectId: entry.projectId, deletedBranchId: id },
    });
  };
};

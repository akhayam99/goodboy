import { getDeletedBranch } from '@goodboy/db';
import type { DeletedBranch, WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { releaseDeletedBranch } from './releaseDeletedBranch';
import type { ForgetDeletedBranchesParams, SetFn } from './types';

type WithoutParams = {
  readonly byWorkspace: Readonly<Record<WorkspaceId, ReadonlyArray<DeletedBranch>>>;
  readonly released: ReadonlySet<string>;
};

const without = ({
  byWorkspace,
  released,
}: WithoutParams): Readonly<Record<WorkspaceId, ReadonlyArray<DeletedBranch>>> => {
  const next: Record<WorkspaceId, ReadonlyArray<DeletedBranch>> = {};
  for (const [workspaceId, entries] of Object.entries(byWorkspace)) {
    next[workspaceId as WorkspaceId] = entries.filter((entry) => !released.has(entry.id));
  }
  return next;
};

export const forgetDeletedBranches = (set: SetFn) => {
  return async ({ ids }: ForgetDeletedBranchesParams): Promise<void> => {
    const released = new Set<string>();
    for (const id of ids) {
      const entry = await getDeletedBranch({ db: tauriDatabase, id });
      if (entry === null || entry.restoredAt !== null) {
        continue;
      }
      await releaseDeletedBranch({ entry });
      released.add(id);
    }
    if (released.size === 0) {
      return;
    }
    set((state) => ({
      deletedBranches: without({ byWorkspace: state.deletedBranches, released }),
    }));
  };
};

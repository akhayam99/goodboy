import { mountError } from './mountErrors';
import { withoutMountBranchGone } from './mountBranchGone';
import { sessionMountViews } from './mountRowModel';
import type { SliceDeps } from '../../slice-types';
import type { MountKeyInput } from './types';

export const restoreGoneBranch = ({ set, get }: SliceDeps) => {
  return async ({ sessionId, mountId }: MountKeyInput): Promise<void> => {
    const restorableId = get().mountBranchGone[mountId]?.restorableBranchId ?? null;
    if (restorableId === null) {
      throw mountError({
        code: 'branch-missing',
        message: 'no saved copy of this branch to restore',
        mountId,
      });
    }
    const expectedRevision = sessionMountViews({ state: get(), sessionId }).find(
      (candidate) => candidate.id === mountId,
    )?.revision;
    await get().restoreDeletedBranch({ id: restorableId });
    await get().attachMount({ sessionId, mountId, expectedRevision });
    set((state) => ({
      mountBranchGone: withoutMountBranchGone({ gone: state.mountBranchGone, mountId }),
    }));
  };
};

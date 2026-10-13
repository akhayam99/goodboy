import type { SessionMountView } from '@goodboy/types';
import { isBranchDeletedEverywhere } from './isBranchDeletedEverywhere';
import { withoutMountBranchGone } from './mountBranchGone';
import { sessionMountViews } from './mountRowModel';
import type { AppStore } from '../../store';
import type { SliceDeps } from '../../slice-types';
import type { MountKeyInput } from './types';

type ClosedViewParams = MountKeyInput & {
  readonly state: AppStore;
};

const closedViewOf = ({ state, sessionId, mountId }: ClosedViewParams): SessionMountView | null => {
  const view = sessionMountViews({ state, sessionId }).find(
    (candidate) => candidate.id === mountId,
  );
  if (view === undefined || (view.isAttached && view.worktreePath !== null)) {
    return null;
  }
  return view;
};

export const checkMountBranchGone = ({ set, get }: SliceDeps) => {
  return async ({ sessionId, mountId }: MountKeyInput): Promise<boolean> => {
    const view = closedViewOf({ state: get(), sessionId, mountId });
    if (view === null || view.branch === '') {
      set((state) => ({
        mountBranchGone: withoutMountBranchGone({ gone: state.mountBranchGone, mountId }),
      }));
      return false;
    }
    const isGone = await isBranchDeletedEverywhere({
      repoRoot: view.repoRoot,
      branch: view.branch,
    });
    const current = closedViewOf({ state: get(), sessionId, mountId });
    if (
      current === null ||
      current.revision !== view.revision ||
      current.branch !== view.branch ||
      current.repoRoot !== view.repoRoot
    ) {
      return false;
    }
    if (!isGone) {
      set((state) => ({
        mountBranchGone: withoutMountBranchGone({ gone: state.mountBranchGone, mountId }),
      }));
      return false;
    }
    const kept = Object.values(get().deletedBranches)
      .flat()
      .find(
        (entry) =>
          entry.repoRoot === view.repoRoot &&
          entry.branch === view.branch &&
          entry.restoredAt === null,
      );
    set((state) => ({
      mountBranchGone: {
        ...state.mountBranchGone,
        [mountId]: { restorableBranchId: kept?.id ?? null },
      },
    }));
    return true;
  };
};

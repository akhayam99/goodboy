import type { SessionId } from '@goodboy/types';
import type { SliceDeps } from '../../slice-types';
import { committedDockGrid } from './committedDockGrid';
import { gridAtRest } from './gridAtRest';
import { EMPTY_DRAWER_GRID } from './state';
import { storedDockGridOf } from './storedDockGrid';

type ResetParams = {
  readonly sessionId: SessionId | null;
};

export const resetDockGrid = ({ set, get }: SliceDeps) => {
  return async ({ sessionId }: ResetParams): Promise<boolean> => {
    const before = get().drawerGrid ?? EMPTY_DRAWER_GRID;
    const next = gridAtRest({ grid: before });
    if (storedDockGridOf({ grid: next }) === storedDockGridOf({ grid: before })) {
      return false;
    }
    const isReset = await committedDockGrid({
      set,
      get,
      sessionId,
      before,
      next,
      failureTitle: "Couldn't reset the panel layout",
    });
    if (!isReset) {
      return false;
    }
    get().undoable({
      message: 'Panel layout reset',
      isCurrent: () => (get().drawerGrid ?? EMPTY_DRAWER_GRID) === next,
      undo: () =>
        committedDockGrid({
          set,
          get,
          sessionId,
          before: next,
          next: before,
          failureTitle: "Couldn't bring the panel layout back",
        }),
    });
    return true;
  };
};

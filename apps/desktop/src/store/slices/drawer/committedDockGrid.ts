import type { SessionId } from '@goodboy/types';
import { saveSessionDockGrid } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { commitAfterConfirm } from '../../runtime/state-writes/commitAfterConfirm';
import type { SliceDeps } from '../../slice-types';
import { dockGridWrites } from './dockGridWrites';
import { EMPTY_DRAWER_GRID, type DrawerGrid } from './state';
import { storedDockGridOf } from './storedDockGrid';

type Params = SliceDeps & {
  readonly sessionId: SessionId | null;
  readonly before: DrawerGrid;
  readonly next: DrawerGrid;
  readonly failureTitle: string;
};

export const committedDockGrid = async ({
  set,
  get,
  sessionId,
  before,
  next,
  failureTitle,
}: Params): Promise<boolean> => {
  let isApplied = false;
  await commitAfterConfirm({
    get,
    failureTitle,
    target: sessionId === null ? {} : { sessionId },
    step: async () => {
      if (sessionId === null) {
        return;
      }
      await dockGridWrites.run({
        key: sessionId,
        task: () =>
          saveSessionDockGrid({
            db: tauriDatabase,
            sessionId,
            grid: storedDockGridOf({ grid: next }),
            savedAt: Date.now(),
          }),
      });
    },
    commit: () => {
      const state = get();
      if (
        state.currentSessionId !== sessionId ||
        (state.drawerGrid ?? EMPTY_DRAWER_GRID) !== before
      ) {
        return;
      }
      set({ drawerGrid: next });
      isApplied = true;
    },
  });
  return isApplied;
};

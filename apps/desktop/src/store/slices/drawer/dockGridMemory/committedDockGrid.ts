import type { SessionId } from '@goodboy/types';
import { saveSessionDockGrid } from '@goodboy/db';
import { tauriDatabase } from '../../../../shared/lib/db';
import { commitAfterConfirm } from '../../../runtime/state-writes/commitAfterConfirm';
import type { SliceDeps } from '../../../slice-types';
import {
  DOCK_GRID_MOVE_KEY,
  dockGridMoves,
  dockGridOwner,
  dockGridWrites,
} from '../dockGridWrites';
import { EMPTY_DRAWER_GRID, type DrawerGrid } from '../state';
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
  if (sessionId !== dockGridOwner.read()) {
    return false;
  }
  const claim = dockGridMoves.claim({ key: DOCK_GRID_MOVE_KEY });
  const savedAt = Date.now();
  const isSourceCurrent = (): boolean =>
    claim.isCurrent() && (get().drawerGrid ?? EMPTY_DRAWER_GRID) === before;
  let isApplied = false;
  await commitAfterConfirm({
    get,
    failureTitle,
    target: sessionId === null ? {} : { sessionId },
    step: async () => {
      if (sessionId === null) {
        return { isWritten: true };
      }
      return dockGridWrites.run({
        key: sessionId,
        task: async () => {
          if (!isSourceCurrent()) {
            return { isWritten: false };
          }
          await saveSessionDockGrid({
            db: tauriDatabase,
            sessionId,
            grid: storedDockGridOf({ grid: next }),
            savedAt,
          });
          return { isWritten: true };
        },
      });
    },
    commit: ({ isWritten }) => {
      if (!isWritten || !isSourceCurrent()) {
        return;
      }
      set({ drawerGrid: next });
      isApplied = true;
    },
  });
  return isApplied;
};

import type { SessionId } from '@goodboy/types';
import { getSessionDockGrid } from '@goodboy/db';
import { tauriDatabase } from '../../../../shared/lib/db';
import { commitAfterConfirm } from '../../../runtime/state-writes/commitAfterConfirm';
import type { SliceDeps } from '../../../slice-types';
import { DOCK_GRID_RECALL_KEY, dockGridRecalls, dockGridWrites } from '../dockGridWrites';
import { appliedDockGrid } from './appliedDockGrid';
import { EMPTY_DRAWER_GRID } from '../state';

type RecallParams = {
  readonly sessionId: SessionId;
};

export const recallDockGrid = ({ set, get }: SliceDeps) => {
  return async ({ sessionId }: RecallParams): Promise<string | null> => {
    const claim = dockGridRecalls.claim({ key: DOCK_GRID_RECALL_KEY });
    const before = get().drawerGrid ?? EMPTY_DRAWER_GRID;
    const result = await commitAfterConfirm({
      get,
      failureTitle: "Couldn't load the panels of this session",
      target: { sessionId },
      step: () =>
        dockGridWrites
          .run({ key: sessionId, task: () => getSessionDockGrid({ db: tauriDatabase, sessionId }) })
          .catch((error: unknown) => {
            if (claim.isCurrent()) {
              throw error;
            }
            return null;
          }),
      commit: () => undefined,
    });
    if (!result.isOk) {
      return null;
    }
    return appliedDockGrid({ set, get, sessionId, raw: result.value, claim, before });
  };
};

import type { SessionId } from '@goodboy/types';
import { getSessionDockGrid } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { commitAfterConfirm } from '../../runtime/state-writes/commitAfterConfirm';
import type { SliceDeps } from '../../slice-types';
import { DOCK_GRID_RECALL_KEY, dockGridRecalls, dockGridWrites } from './dockGridWrites';
import { appliedDockGrid } from './appliedDockGrid';
import { EMPTY_DRAWER_GRID } from './state';
import { faceSelections } from '../session-view/faceSelections';
import { storedFaceOf } from '../session-view/storedFaceOf';

type RecallParams = {
  readonly sessionId: SessionId;
  readonly isSavedThisRun: boolean;
};

export const recallDockGrid = ({ set, get }: SliceDeps) => {
  return async ({ sessionId, isSavedThisRun }: RecallParams): Promise<string | null> => {
    const claim = dockGridRecalls.claim({ key: DOCK_GRID_RECALL_KEY });
    const before = get().drawerGrid ?? EMPTY_DRAWER_GRID;
    const selection = faceSelections.read({ sessionId });
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
    const face = storedFaceOf({ raw: result.value });
    const applied = appliedDockGrid({
      set,
      get,
      raw: result.value,
      face,
      claim,
      before,
      isSavedThisRun,
    });
    if (claim.isCurrent() && faceSelections.read({ sessionId }) === selection) {
      set((state) => ({ sessionFace: { ...state.sessionFace, [sessionId]: face } }));
    }
    return applied;
  };
};

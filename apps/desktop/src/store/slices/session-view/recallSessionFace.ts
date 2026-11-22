import { getSessionDockGrid } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { commitAfterConfirm } from '../../runtime/state-writes/commitAfterConfirm';
import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import type { SliceDeps } from '../../slice-types';
import { dockGridWrites } from '../drawer/dockGridWrites';
import { faceSelections } from './faceSelections';
import { storedFaceOf } from './storedFaceOf';
import type { SessionFace, SessionFaceParams } from './types';

const faceRecalls = createLatestOnly();

export const recallSessionFace = ({ set, get }: SliceDeps) => {
  return async ({ sessionId }: SessionFaceParams): Promise<SessionFace | null> => {
    const claim = faceRecalls.claim({ key: sessionId });
    const selection = faceSelections.read({ sessionId });
    const result = await commitAfterConfirm({
      get,
      failureTitle: "Couldn't load the last view of this session",
      target: { sessionId },
      step: () =>
        dockGridWrites.run({
          key: sessionId,
          task: () => getSessionDockGrid({ db: tauriDatabase, sessionId }),
        }),
      commit: () => undefined,
    });
    if (!result.isOk || !claim.isCurrent() || faceSelections.read({ sessionId }) !== selection) {
      return null;
    }
    const face = storedFaceOf({ raw: result.value });
    set((state) => ({ sessionFace: { ...state.sessionFace, [sessionId]: face } }));
    return face;
  };
};

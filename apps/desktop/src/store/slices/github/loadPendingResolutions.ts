import { listPendingResolutionsForSession } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { pendingResolutionReadsInFlight, type GetFn, type SetFn } from './types';

export const loadPendingResolutions = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId): Promise<void> => {
    if (get().sessionPendingResolutions[sessionId] !== undefined) {
      return;
    }
    if (pendingResolutionReadsInFlight.has(sessionId)) {
      return;
    }
    pendingResolutionReadsInFlight.add(sessionId);
    try {
      const rows = await listPendingResolutionsForSession({ db: tauriDatabase, sessionId });
      set((state) => ({
        sessionPendingResolutions: { ...state.sessionPendingResolutions, [sessionId]: rows },
      }));
    } finally {
      pendingResolutionReadsInFlight.delete(sessionId);
    }
  };
};

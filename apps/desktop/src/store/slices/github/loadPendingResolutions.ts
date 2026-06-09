import { listPendingResolutionsForSession } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { pendingResolutionsInFlight, type GetFn, type SetFn } from './types';

export const loadPendingResolutions = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId): Promise<void> => {
    if (get().sessionPendingResolutions[sessionId] !== undefined) return;
    if (pendingResolutionsInFlight.has(sessionId)) return;
    pendingResolutionsInFlight.add(sessionId);
    try {
      const rows = await listPendingResolutionsForSession(tauriDatabase, sessionId);
      set((state) => ({
        sessionPendingResolutions: { ...state.sessionPendingResolutions, [sessionId]: rows },
      }));
    } finally {
      pendingResolutionsInFlight.delete(sessionId);
    }
  };
};

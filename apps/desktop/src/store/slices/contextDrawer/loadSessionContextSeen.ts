import type { IsoDateTime, SessionId } from '@goodboy/types';
import { getSessionContextSeenAt, setSessionContextSeenAt } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export const loadSessionContextSeen = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId): Promise<void> => {
    const stored = await getSessionContextSeenAt(tauriDatabase, sessionId).catch(() => null);
    const current = get().sessionContextSeenAt[sessionId];
    if (stored !== null) {
      if (typeof current === 'string' && current >= stored) {
        return;
      }
      set((state) => ({
        sessionContextSeenAt: { ...state.sessionContextSeenAt, [sessionId]: stored },
        sessionDecisionsBaseline: { ...state.sessionDecisionsBaseline, [sessionId]: stored },
      }));
      return;
    }
    if (current !== undefined) {
      return;
    }
    const seenAt = new Date().toISOString() as IsoDateTime;
    set((state) => ({
      sessionContextSeenAt: { ...state.sessionContextSeenAt, [sessionId]: seenAt },
    }));
    await setSessionContextSeenAt(tauriDatabase, sessionId, seenAt).catch(() => undefined);
  };
};

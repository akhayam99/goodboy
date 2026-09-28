import type { IsoDateTime, SessionId } from '@goodboy/types';
import { getSessionContextSeenAt, setSessionContextSeenAt } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export const loadSessionContextSeen = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId): Promise<void> => {
    if (get().sessionContextSeenAt[sessionId] !== undefined) {
      return;
    }
    const stored = await getSessionContextSeenAt(tauriDatabase, sessionId).catch(() => null);
    if (get().sessionContextSeenAt[sessionId] !== undefined) {
      return;
    }
    const seenAt = stored ?? (new Date().toISOString() as IsoDateTime);
    set((state) => ({
      sessionContextSeenAt: { ...state.sessionContextSeenAt, [sessionId]: seenAt },
    }));
    if (stored !== null) {
      return;
    }
    await setSessionContextSeenAt(tauriDatabase, sessionId, seenAt).catch(() => undefined);
  };
};

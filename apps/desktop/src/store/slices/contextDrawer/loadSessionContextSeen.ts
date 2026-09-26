import type { SessionId } from '@goodboy/types';
import { getSessionContextSeenAt } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export const loadSessionContextSeen = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId): Promise<void> => {
    if (get().sessionContextSeenAt[sessionId] !== undefined) {
      return;
    }
    const seenAt = await getSessionContextSeenAt(tauriDatabase, sessionId);
    set((state) => ({
      sessionContextSeenAt: { ...state.sessionContextSeenAt, [sessionId]: seenAt },
    }));
  };
};

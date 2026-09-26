import type { IsoDateTime, SessionId } from '@goodboy/types';
import { setSessionContextSeenAt } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const markSessionContextSeen = (set: SetFn) => {
  return async (sessionId: SessionId): Promise<void> => {
    const seenAt = new Date().toISOString() as IsoDateTime;
    set((state) => ({
      sessionContextSeenAt: { ...state.sessionContextSeenAt, [sessionId]: seenAt },
    }));
    await setSessionContextSeenAt(tauriDatabase, sessionId, seenAt).catch(() => undefined);
  };
};

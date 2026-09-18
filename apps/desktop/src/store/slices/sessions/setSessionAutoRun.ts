import type { IsoDateTime, SessionId } from '@goodboy/types';
import { updateSessionAutoRun } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const setSessionAutoRun = (set: SetFn) => {
  return async (sessionId: SessionId, autoRun: boolean) => {
    const now = new Date().toISOString() as IsoDateTime;
    await updateSessionAutoRun(tauriDatabase, sessionId, autoRun, now);
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, autoRun, updatedAt: now } : s,
      ),
    }));
  };
};

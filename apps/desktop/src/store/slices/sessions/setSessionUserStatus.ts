import type { IsoDateTime, SessionId, SessionUserStatus } from '@goodboy/types';
import { updateSessionUserStatus } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export function setSessionUserStatus(set: SetFn) {
  return async (sessionId: SessionId, status: SessionUserStatus) => {
    const now = new Date().toISOString() as IsoDateTime;
    await updateSessionUserStatus(tauriDatabase, sessionId, status, now);
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, userStatus: status, updatedAt: now } : s,
      ),
    }));
  };
}

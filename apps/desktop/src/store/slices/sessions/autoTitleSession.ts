import type { IsoDateTime, SessionId } from '@goodboy/types';
import { renameSession as renameSessionInDb } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export const autoTitleSession = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, title: string) => {
    if (!title.trim()) {
      return;
    }
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session || session.titleUserEdited) {
      return;
    }
    const now = new Date().toISOString() as IsoDateTime;
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, goal: title.trim() } : s)),
    }));
    await renameSessionInDb(tauriDatabase, sessionId, title.trim(), now, false);
  };
};

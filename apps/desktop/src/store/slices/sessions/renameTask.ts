import type { IsoDateTime, SessionId } from '@goodboy/types';
import { renameSession as renameSessionInDb } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export const renameTask = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, goal: string) => {
    if (!goal.trim()) throw new Error('session name cannot be empty');
    const now = new Date().toISOString() as IsoDateTime;
    const prev = get().sessions.find((s) => s.id === sessionId);
    if (!prev) throw new Error(`session not found: ${sessionId}`);
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, goal: goal.trim(), titleUserEdited: true, updatedAt: now } : s,
      ),
    }));
    try {
      await renameSessionInDb(tauriDatabase, sessionId, goal.trim(), now, true);
    } catch (err) {
      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === sessionId ? prev : s)),
      }));
      throw err;
    }
  };
};

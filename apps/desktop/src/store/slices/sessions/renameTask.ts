import type { IsoDateTime, SessionId } from '@goodboy/types';
import { renameSession as renameSessionInDb } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { clampTitle } from './titleLimit';
import type { GetFn, SetFn } from './types';

export const renameTask = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, goal: string) => {
    const title = clampTitle(goal);
    if (!title) {
      throw new Error('session name cannot be empty');
    }
    const now = new Date().toISOString() as IsoDateTime;
    const prev = get().sessions.find((s) => s.id === sessionId);
    if (!prev) {
      throw new Error(`session not found: ${sessionId}`);
    }
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, goal: title, titleUserEdited: true, updatedAt: now } : s,
      ),
    }));
    try {
      await renameSessionInDb(tauriDatabase, sessionId, title, now, true);
    } catch (err) {
      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === sessionId ? prev : s)),
      }));
      throw err;
    }
  };
};

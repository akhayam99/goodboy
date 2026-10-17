import type { IsoDateTime, SessionId } from '@goodboy/types';
import { renameSession as renameSessionInDb } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { clampTitle } from './titleLimit';
import type { GetFn, SetFn } from './types';
import { sessionById } from './sessionIndex';

export const renameTask = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, goal: string) => {
    const title = clampTitle(goal);
    if (!title) {
      throw new Error('session name cannot be empty');
    }
    const now = new Date().toISOString() as IsoDateTime;
    if (sessionById(get().sessions, sessionId) === undefined) {
      throw new Error(`session not found: ${sessionId}`);
    }
    await renameSessionInDb(tauriDatabase, sessionId, title, now, true);
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, goal: title, titleUserEdited: true, updatedAt: now } : s,
      ),
    }));
  };
};

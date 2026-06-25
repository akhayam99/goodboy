import type { IsoDateTime, SessionId } from '@goodboy/types';
import { renameSession as renameSessionInDb } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { clampTitle } from './titleLimit';
import type { GetFn, SetFn } from './types';

export const autoTitleSession = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, title: string) => {
    const clamped = clampTitle(title);
    if (!clamped) {
      return;
    }
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session || session.titleUserEdited) {
      return;
    }
    const now = new Date().toISOString() as IsoDateTime;
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, goal: clamped } : s)),
    }));
    await renameSessionInDb(tauriDatabase, sessionId, clamped, now, false);
  };
};

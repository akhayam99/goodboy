import type { IsoDateTime, SessionId } from '@goodboy/types';
import { renameSession as renameSessionInDb } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { clampTitle } from '../sessions/titleLimit';
import { draftGoalText } from './draftGoalText';
import type { GetFn, SetFn } from './types';

export type SaveSessionSetupGoalParams = {
  readonly sessionId: SessionId;
  readonly goal: string;
};

export const saveSessionSetupGoal = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, goal }: SaveSessionSetupGoalParams): Promise<void> => {
    const text = goal.trim();
    if (text === '') {
      return;
    }
    await get().upsertSessionSlot(sessionId, 'goal', text);
    const session = get().sessions.find((candidate) => candidate.id === sessionId);
    if (session === undefined || session.goal.trim() !== '') {
      return;
    }
    const title = clampTitle(draftGoalText({ text }));
    const now = new Date().toISOString() as IsoDateTime;
    set((state) => ({
      sessions: state.sessions.map((candidate) =>
        candidate.id === sessionId ? { ...candidate, goal: title, updatedAt: now } : candidate,
      ),
      goodboyNamedSessionId: sessionId,
    }));
    await renameSessionInDb(tauriDatabase, sessionId, title, now, false);
  };
};

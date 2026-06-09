import type { SessionId } from '@goodboy/types';
import { listOpenQuestionsForSession } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const loadSessionOpenQuestions = (set: SetFn) => {
  return async (sessionId: SessionId) => {
    const questions = await listOpenQuestionsForSession(tauriDatabase, sessionId, 'open');
    set((state) => ({
      sessionOpenQuestions: { ...state.sessionOpenQuestions, [sessionId]: questions },
    }));
  };
};

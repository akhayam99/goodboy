import type { SessionId } from '@goodboy/types';
import { listOpenQuestionsForSession } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import { clearQuestionsLoadError, recordQuestionsLoadError } from './questionsLoadError';
import type { SetFn } from './types';

const latest = createLatestOnly();

export const loadSessionAnsweredQuestions = (set: SetFn) => {
  return async (sessionId: SessionId) => {
    const claim = latest.claim({ key: sessionId });
    try {
      const questions = await listOpenQuestionsForSession(tauriDatabase, sessionId, 'answered');
      if (!claim.isCurrent()) {
        return;
      }
      set(clearQuestionsLoadError({ sessionId }));
      set((state) => ({
        sessionAnsweredQuestions: { ...state.sessionAnsweredQuestions, [sessionId]: questions },
      }));
    } catch (error) {
      if (!claim.isCurrent()) {
        return;
      }
      set(recordQuestionsLoadError({ sessionId, error }));
    }
  };
};

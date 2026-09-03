import type { OpenQuestion, SessionId } from '@goodboy/types';
import { markOpenQuestionDismissed } from '@goodboy/db';
import { removeQuestionsFromSlot } from '@goodboy/core';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export const dismissOpenQuestion = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, question: OpenQuestion) => {
    await markOpenQuestionDismissed(tauriDatabase, question.id);
    set((state) => ({
      sessionOpenQuestions: {
        ...state.sessionOpenQuestions,
        [sessionId]: (state.sessionOpenQuestions[sessionId] ?? []).filter(
          (q) => q.id !== question.id,
        ),
      },
    }));
    await get().loadSessionDismissedQuestions(sessionId);
    const slotChanged = await removeQuestionsFromSlot(tauriDatabase, sessionId, [question.text]);
    if (slotChanged) {
      await get().loadSessionSlots(sessionId);
    }
    void get().maybeAutoAdvanceWorkflow(sessionId);
  };
};

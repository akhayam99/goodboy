import type { OpenQuestion, SessionId } from '@goodboy/types';
import { restoreOpenQuestion } from '@goodboy/db';
import { addQuestionsToSlot } from '@goodboy/core';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export const restoreDismissedOpenQuestion = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, question: OpenQuestion) => {
    await restoreOpenQuestion(tauriDatabase, question.id);
    set((state) => {
      const current = state.sessionOpenQuestions[sessionId] ?? [];
      if (current.some((q) => q.id === question.id)) return {};
      const next = [...current, { ...question, status: 'open' as const }].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      return {
        sessionOpenQuestions: { ...state.sessionOpenQuestions, [sessionId]: next },
      };
    });
    const slotChanged = await addQuestionsToSlot(tauriDatabase, sessionId, [question.text]);
    if (slotChanged) await get().loadSessionSlots(sessionId);
  };
};

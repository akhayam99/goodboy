import type { OpenQuestion, SessionId } from '@goodboy/types';
import { markOpenQuestionDismissed } from '@goodboy/db';
import { removeQuestionsFromSlot } from '@goodboy/core';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export const BLOCKING_DISMISSAL_REFUSAL =
  'The agent stopped on this one because it cannot decide it for you. Answer it to let the step carry on.';

type SettleParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly question: OpenQuestion;
};

export const settleDismissedQuestion = async ({
  set,
  get,
  sessionId,
  question,
}: SettleParams): Promise<void> => {
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
  await get().recordSessionEvent({
    sessionId,
    kind: 'question_dismissed',
    payload: { questionId: question.id, title: question.text },
  });
  const slotChanged = await removeQuestionsFromSlot(tauriDatabase, sessionId, [question.text]);
  if (slotChanged) {
    await get().loadSessionSlots(sessionId);
  }
};

export const dismissOpenQuestion = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, question: OpenQuestion) => {
    if (question.isBlocking) {
      void get().emitNotification({
        kind: 'error',
        severity: 'warning',
        title: 'This question cannot be discarded',
        body: BLOCKING_DISMISSAL_REFUSAL,
        sessionId,
        coalesceKey: `blocking-question:${question.id}`,
      });
      return;
    }
    await settleDismissedQuestion({ set, get, sessionId, question });
    void get().maybeAutoAdvanceWorkflow(sessionId);
  };
};

import { useCallback } from 'react';
import type { OpenQuestion, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import {
  deriveDraftAnswer,
  useOpenQuestions,
} from '../../components/QuestionsTab/useOpenQuestions';

type Params = {
  readonly sessionId: SessionId;
};

export const canSendQuestionAsMessage = (question: OpenQuestion): boolean =>
  question.status === 'open' && question.isBlocking && question.createdByAgentId != null;

export const useSendQuestionAsMessage = ({ sessionId }: Params) => {
  const sendQuestionAsMessage = useAppStore((state) => state.sendQuestionAsMessage);
  const clearDraft = useOpenQuestions((state) => state.clearDraft);

  return useCallback(
    async (question: OpenQuestion) => {
      const text = deriveDraftAnswer(useOpenQuestions.getState().drafts[question.id]);
      if (text.length === 0 || !canSendQuestionAsMessage(question)) {
        return;
      }
      clearDraft(question.id);
      await sendQuestionAsMessage({ sessionId, question, text });
    },
    [clearDraft, sendQuestionAsMessage, sessionId],
  );
};

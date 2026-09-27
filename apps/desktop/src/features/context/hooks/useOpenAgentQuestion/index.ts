import { useCallback } from 'react';
import type { OpenQuestion, SessionId } from '@goodboy/types';
import { agentPlace, sessionPlace, useAppStore } from '../../../../store';

type Params = {
  readonly sessionId: SessionId;
};

type OpenParams = {
  readonly question: OpenQuestion;
};

export const useOpenAgentQuestion = ({ sessionId }: Params) => {
  const navigate = useAppStore((state) => state.navigate);
  const requestOpenQuestionScroll = useAppStore((state) => state.requestOpenQuestionScroll);
  return useCallback(
    ({ question }: OpenParams) => {
      if (question.createdByAgentId == null) {
        navigate({ to: sessionPlace({ sessionId, lens: 'questions' }) });
        return;
      }
      navigate({ to: agentPlace({ sessionId, agentId: question.createdByAgentId }) });
      requestOpenQuestionScroll({ agentId: question.createdByAgentId, questionId: question.id });
      window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
    },
    [navigate, requestOpenQuestionScroll, sessionId],
  );
};

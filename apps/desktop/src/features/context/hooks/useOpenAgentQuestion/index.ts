import { useCallback } from 'react';
import type { AgentId, OpenQuestionId, SessionId } from '@goodboy/types';
import { agentPlace, sessionPlace, useAppStore } from '../../../../store';
import { openAgentRevealEvent } from '../../../session/components/AgentDetailPane/agentOpenTab';

type Params = {
  readonly sessionId: SessionId;
};

type OpenParams = {
  readonly question: {
    readonly id: OpenQuestionId;
    readonly createdByAgentId?: AgentId | null;
  };
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
      navigate({
        to: agentPlace({ sessionId, agentId: question.createdByAgentId, pane: 'brief' }),
      });
      requestOpenQuestionScroll({ agentId: question.createdByAgentId, questionId: question.id });
      window.dispatchEvent(openAgentRevealEvent());
    },
    [navigate, requestOpenQuestionScroll, sessionId],
  );
};

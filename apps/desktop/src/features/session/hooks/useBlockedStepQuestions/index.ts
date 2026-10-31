import { useMemo } from 'react';
import type { AgentId, OpenQuestion, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

const NO_QUESTIONS: ReadonlyArray<OpenQuestion> = [];

export const useBlockedStepQuestions = ({
  sessionId,
  agentId,
}: Params): ReadonlyArray<OpenQuestion> => {
  const questions = useAppStore((state) => state.sessionOpenQuestions[sessionId] ?? NO_QUESTIONS);
  return useMemo(
    () =>
      questions.filter(
        (question) => question.status === 'open' && question.createdByAgentId === agentId,
      ),
    [questions, agentId],
  );
};

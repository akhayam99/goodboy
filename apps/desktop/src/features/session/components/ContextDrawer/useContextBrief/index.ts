import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useSessionOpenQuestions } from '../../../../../store';
import { shareableContext } from '../../../context/shareableContext';

type Params = {
  readonly sessionId: SessionId;
  readonly goal: string;
  readonly decisions: string;
  readonly summary: string;
};

export const useContextBrief = ({ sessionId, goal, decisions, summary }: Params): string => {
  const openQuestions = useSessionOpenQuestions(sessionId);
  const openQuestionTexts = useMemo(
    () =>
      openQuestions
        .filter((question) => question.status === 'open')
        .map((question) => question.text),
    [openQuestions],
  );
  return shareableContext({ goal, decisions, summary, openQuestions: openQuestionTexts });
};

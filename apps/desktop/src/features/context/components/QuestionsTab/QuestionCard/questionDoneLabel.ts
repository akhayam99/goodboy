import type { OpenQuestion } from '@goodboy/types';
import type { QuestionCardState } from '.';
import { RESOLVED_BY_AGENT } from './resolvedByAgent';

type Params = {
  readonly state: QuestionCardState;
  readonly question: OpenQuestion;
  readonly askerName: string | null;
  readonly answeredByName: string | null;
  readonly isHandedOff: boolean;
};

export const questionDoneLabel = ({
  state,
  question,
  askerName,
  answeredByName,
  isHandedOff,
}: Params): string => {
  const asker = askerName ?? 'the agent';
  if (state === 'dismissed') {
    return 'Dismissed';
  }
  if (state === 'staged') {
    return isHandedOff
      ? 'Handed to an agent · sends with the rest'
      : 'Answered · sends with the rest';
  }
  if (question.userAnswer === RESOLVED_BY_AGENT) {
    return 'Resolved by the agent';
  }
  if (question.answerSource === 'agent') {
    return answeredByName === null ? 'Answered by an agent' : `Answered by ${answeredByName}`;
  }
  return `Answered · sent to ${asker}`;
};

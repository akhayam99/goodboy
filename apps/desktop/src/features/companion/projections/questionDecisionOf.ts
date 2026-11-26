import type { OpenQuestion } from '@goodboy/types';
import type { QuestionDecision } from '../contract/decisions';
import { actionIdOf } from './actionIdOf';
import { safeTextOf } from './safeTextOf';

export const QUESTION_OPTION_LIMIT = 6;

type Params = {
  readonly question: OpenQuestion;
};

export const questionDecisionOf = ({ question }: Params): QuestionDecision => ({
  kind: 'question',
  actionId: actionIdOf({
    kind: 'answerQuestion',
    objectId: question.id,
    version: question.createdAt,
  }),
  questionId: question.id,
  version: question.createdAt,
  text: safeTextOf({ text: question.text, max: 600 }),
  options: question.suggestedAnswers
    .slice(0, QUESTION_OPTION_LIMIT)
    .map((answer) => safeTextOf({ text: answer, max: 160 })),
  recommended:
    question.recommendedAnswer === undefined
      ? null
      : safeTextOf({ text: question.recommendedAnswer, max: 160 }),
});

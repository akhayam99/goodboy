import type { QuestionRow } from '../questionsLensModel';

const RESOLVED_BY_AGENT = '[resolved by agent]';

type Params = {
  readonly row: QuestionRow;
};

export const questionAnswerLine = ({ row }: Params): string => {
  if (row.kind === 'waiting') {
    return '';
  }
  if (row.kind === 'delegated') {
    return 'An agent is answering';
  }
  if (row.kind === 'staged') {
    return 'Sending your answer';
  }
  if (row.kind === 'dismissed') {
    return 'Dismissed';
  }
  const answer = (row.question.userAnswer ?? '').replace(/\s+/g, ' ').trim();
  if (answer === '') {
    return '';
  }
  if (answer === RESOLVED_BY_AGENT) {
    return 'Resolved by an agent';
  }
  return row.question.answerSource === 'agent' ? `Agent: ${answer}` : `You: ${answer}`;
};

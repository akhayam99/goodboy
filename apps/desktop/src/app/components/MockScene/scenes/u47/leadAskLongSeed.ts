import { brandId, type OpenQuestion, type OpenQuestionId } from '@goodboy/types';
import { AUTO_ROOT_ID, AUTO_SESSION } from '../u24/autoSceneSeed';

const AT = '2026-11-17T09:30:00.000Z';

export const LEAD_LONG_QUESTION_ID = brandId<OpenQuestionId>({
  value: 'mock-u47-lead-ask-retry',
});

export const LEAD_LONG_ANSWER = [
  'Keep the retry in payments-api, not in ledger-core.',
  'Back off from 200ms and double each time, at most five tries.',
  'Never retry a 4xx: only timeouts and 5xx.',
  'Log each retry with the request id so notify-relay can trace it.',
  'Put the limits in config.ts, next to MAX_RETRY_ATTEMPTS.',
  'Add a test for the fifth try failing, and one for a 409 that never retries.',
  'Leave the Northwind adapter alone, it already retries on its own.',
  'Ask me again if the Acme sandbox rejects the backoff.',
].join('\n');

type QuestionParams = {
  readonly id: OpenQuestionId;
  readonly text: string;
  readonly answers: ReadonlyArray<string>;
};

const questionOf = ({ id, text, answers }: QuestionParams): OpenQuestion => ({
  id,
  sessionId: AUTO_SESSION.id,
  createdByAgentId: AUTO_ROOT_ID,
  text,
  suggestedAnswers: [...answers],
  recommendedAnswer: answers[0],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: brandId({ value: AT }),
});

export const LEAD_LONG_QUESTIONS: ReadonlyArray<OpenQuestion> = [
  questionOf({
    id: LEAD_LONG_QUESTION_ID,
    text: 'Where should the payment retry live?',
    answers: ['In payments-api', 'In ledger-core'],
  }),
  questionOf({
    id: brandId<OpenQuestionId>({ value: 'mock-u47-lead-ask-tests' }),
    text: 'Run the retry tests on Node 22 only?',
    answers: ['Node 22 only', 'Node 20 and 22'],
  }),
];

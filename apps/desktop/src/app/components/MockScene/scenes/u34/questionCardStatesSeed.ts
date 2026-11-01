import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type OpenQuestion,
  type OpenQuestionId,
  type SessionId,
  type WorkflowRunId,
} from '@goodboy/types';
import type { QuestionDraft } from '../../../../../features/context/components/QuestionsTab/useOpenQuestions';
import { PERSON_ANSWERS } from '../../../../../features/context/components/QuestionsTab/useOpenQuestions';
import type { QuestionCardState } from '../../../../../features/context/components/QuestionsTab/QuestionCard';

export type QuestionCardCase = {
  readonly name: string;
  readonly question: OpenQuestion;
  readonly variant: 'full' | 'compact';
  readonly state: QuestionCardState;
  readonly pagerSize: number;
  readonly draft: QuestionDraft | undefined;
  readonly answeredByName: string | null;
};

type QuestionParams = {
  readonly id: string;
  readonly text: string;
  readonly suggestedAnswers?: ReadonlyArray<string>;
  readonly recommendedAnswer?: string;
  readonly userAnswer?: string | null;
};

const questionOf = ({
  id,
  text,
  suggestedAnswers = ['Batch them', 'Leave them out'],
  recommendedAnswer,
  userAnswer = null,
}: QuestionParams): OpenQuestion => ({
  id: brandId<OpenQuestionId>({ value: id }),
  sessionId: brandId<SessionId>({ value: 'session-harborline' }),
  workflowRunId: brandId<WorkflowRunId>({ value: 'run-ledger-core' }),
  createdByAgentId: brandId<AgentId>({ value: 'agent-implementer' }),
  text,
  suggestedAnswers,
  ...(recommendedAnswer === undefined ? {} : { recommendedAnswer }),
  selectMode: 'one',
  isBlocking: true,
  userAnswer,
  status: 'open',
  createdAt: brandId<IsoDateTime>({ value: '2026-10-31T15:10:00.000Z' }),
});

const SHORT = questionOf({
  id: 'qc-short',
  text: 'Should refunds older than 90 days be batched too?',
  recommendedAnswer: 'Batch them',
});

const TWO_LINES = questionOf({
  id: 'qc-two',
  text: 'Should notify-relay resend a webhook that Harborline already acknowledged, or skip it?',
});

const THREE_LINES = questionOf({
  id: 'qc-three',
  text: 'Should payments-api keep retrying a Northwind settlement that failed three times in a row, or hand it to the Cascadia ledger-core review queue and stop retrying until someone looks at it?',
});

const DRAFT_CUSTOM: QuestionDraft = {
  selectedSuggestions: [],
  customAnswer: 'Batch only the Northwind ones',
  showCustomField: true,
  answerIntent: PERSON_ANSWERS,
};

type CaseParams = Partial<QuestionCardCase> & Pick<QuestionCardCase, 'name' | 'question'>;

const caseOf = ({
  name,
  question,
  variant = 'compact',
  state = 'open',
  pagerSize = 0,
  draft = undefined,
  answeredByName = null,
}: CaseParams): QuestionCardCase => ({
  name,
  question,
  variant,
  state,
  pagerSize,
  draft,
  answeredByName,
});

export const QUESTION_CARD_CASES: ReadonlyArray<QuestionCardCase> = [
  caseOf({ name: 'single', question: SHORT }),
  caseOf({ name: 'pager', question: SHORT, pagerSize: 2 }),
  caseOf({ name: 'long-two', question: TWO_LINES, pagerSize: 2 }),
  caseOf({ name: 'long-three', question: THREE_LINES, pagerSize: 3 }),
  caseOf({ name: 'custom-open', question: SHORT, draft: DRAFT_CUSTOM }),
  caseOf({ name: 'answered', question: { ...SHORT, userAnswer: 'Batch them' }, state: 'answered' }),
  caseOf({
    name: 'resolved-by-agent',
    question: { ...SHORT, userAnswer: '[resolved by agent]' },
    state: 'answered',
    answeredByName: 'Reviewer',
  }),
  caseOf({ name: 'full', question: SHORT, variant: 'full' }),
  caseOf({ name: 'full-pager', question: TWO_LINES, variant: 'full', pagerSize: 2 }),
];

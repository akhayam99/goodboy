import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, OpenQuestion, OpenQuestionId } from '@goodboy/types';
import { buildQuestionsLens, nextWaitingQuestion, visibleQuestionRows } from './questionsLensModel';

type QuestionPatch = {
  readonly id: string;
  readonly isBlocking?: boolean;
  readonly answeredAt?: string;
};

const question = ({ id, isBlocking = false, answeredAt }: QuestionPatch): OpenQuestion =>
  ({
    id: id as OpenQuestionId,
    text: id,
    isBlocking,
    status: answeredAt === undefined ? 'open' : 'answered',
    createdAt: '2026-09-28T10:00:00.000Z',
    answeredAt,
  }) as unknown as OpenQuestion;

const DELEGATE = {
  id: 'delegate' as AgentId,
  ordinal: 1,
  status: 'running',
  sourceKind: 'open_question',
  sourceThreadId: 'q3',
} as unknown as Agent;

const OPEN = [
  question({ id: 'q1', isBlocking: true }),
  question({ id: 'q2' }),
  question({ id: 'q3' }),
];
const ANSWERED = [
  question({ id: 'a1', answeredAt: '2026-09-28T09:00:00.000Z' }),
  question({ id: 'a2', answeredAt: '2026-09-28T09:30:00.000Z' }),
];

const ids = (rows: ReadonlyArray<{ readonly question: OpenQuestion }>) =>
  rows.map((row) => row.question.id);

describe('buildQuestionsLens', () => {
  const model = buildQuestionsLens({
    open: OPEN,
    answered: ANSWERED,
    agents: [DELEGATE],
    staged: ['q2' as OpenQuestionId],
    dismissed: null,
  });

  it('keeps waiting only the questions with no staged answer and no delegate', () => {
    expect(ids(model.waiting)).toEqual(['q1']);
    expect(ids(model.delegated)).toEqual(['q3']);
    expect(model.blockingCount).toBe(1);
  });

  it('puts staged answers first under Answered, then the sent ones newest first', () => {
    expect(ids(model.recent)).toEqual(['q2']);
    expect(ids(model.answered)).toEqual(['a2', 'a1']);
  });

  it('shows the sent answers in the list only once Answered is open', () => {
    expect(ids(visibleQuestionRows({ model, isAnsweredOpen: false }))).toEqual(['q1', 'q3', 'q2']);
    expect(visibleQuestionRows({ model, isAnsweredOpen: true })).toHaveLength(5);
  });

  it('holds a dismissed question aside while its Undo is live', () => {
    const withDismissed = buildQuestionsLens({
      open: OPEN,
      answered: [],
      agents: [],
      staged: [],
      dismissed: OPEN[1]!,
    });
    expect(ids(withDismissed.waiting)).toEqual(['q1', 'q3']);
    expect(withDismissed.recent.map((row) => row.kind)).toEqual(['dismissed']);
  });
});

describe('nextWaitingQuestion', () => {
  const model = buildQuestionsLens({
    open: OPEN,
    answered: [],
    agents: [],
    staged: [],
    dismissed: null,
  });

  it('moves to the next waiting question and wraps around', () => {
    expect(nextWaitingQuestion({ model, from: 'q1' as OpenQuestionId })).toBe('q2');
    expect(nextWaitingQuestion({ model, from: 'q3' as OpenQuestionId })).toBe('q1');
  });

  it('finds nothing once the last waiting question is answered', () => {
    const lone = buildQuestionsLens({
      open: [OPEN[0]!],
      answered: [],
      agents: [],
      staged: [],
      dismissed: null,
    });
    expect(nextWaitingQuestion({ model: lone, from: 'q1' as OpenQuestionId })).toBeNull();
  });
});

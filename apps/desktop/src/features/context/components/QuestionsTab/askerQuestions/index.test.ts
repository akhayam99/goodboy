// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AgentId, OpenQuestion, OpenQuestionId } from '@goodboy/types';
import { askerQuestions, isGroupStaged } from '.';

const question = ({ id, askerId }: { readonly id: string; readonly askerId?: string }) =>
  ({
    id: id as OpenQuestionId,
    createdByAgentId: askerId as AgentId | undefined,
    text: id,
    status: 'open',
  }) as OpenQuestion;

const QUESTIONS = [
  question({ id: 'q1', askerId: 'planner' }),
  question({ id: 'q2', askerId: 'reviewer' }),
  question({ id: 'q3', askerId: 'planner' }),
  question({ id: 'q4' }),
];

describe('askerQuestions', () => {
  it('keeps the questions one agent asked, in order', () => {
    expect(
      askerQuestions({ questions: QUESTIONS, askerId: 'planner' as AgentId }).map((q) => q.id),
    ).toEqual(['q1', 'q3']);
  });

  it('groups the questions with no asking agent together', () => {
    expect(askerQuestions({ questions: QUESTIONS, askerId: null }).map((q) => q.id)).toEqual([
      'q4',
    ]);
  });
});

describe('isGroupStaged', () => {
  const group = askerQuestions({ questions: QUESTIONS, askerId: 'planner' as AgentId });

  it('waits while one question of the agent has no staged answer', () => {
    expect(isGroupStaged({ group, staged: ['q1' as OpenQuestionId] })).toBe(false);
  });

  it('is ready once every question of the agent is staged', () => {
    expect(isGroupStaged({ group, staged: ['q3', 'q1'] as OpenQuestionId[] })).toBe(true);
  });

  it('is never ready for an empty group', () => {
    expect(isGroupStaged({ group: [], staged: [] })).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  SessionId,
  WorkflowId,
  WorkflowRunId,
} from '@goodboy/types';
import { workflowHasOpenQuestions, workflowRunHasOpenQuestions } from './openQuestionsGate';

const NOW = '2026-05-26T00:00:00.000Z' as IsoDateTime;
const SESSION = 'sess_1' as SessionId;
const WF_A = 'wf_a' as WorkflowId;
const WF_B = 'wf_b' as WorkflowId;
const RUN_A = 'run_a' as WorkflowRunId;
const RUN_B = 'run_b' as WorkflowRunId;

function q(id: string, opts: Partial<OpenQuestion> = {}): OpenQuestion {
  return {
    id: id as OpenQuestionId,
    sessionId: SESSION,
    text: id,
    suggestedAnswers: [],
    isBlocking: false,
    userAnswer: null,
    status: 'open',
    createdAt: NOW,
    ...opts,
  };
}

const RUN_A_REF = { id: RUN_A, workflowId: WF_A };
const RUN_B_REF = { id: RUN_B, workflowId: WF_B };

describe('workflowHasOpenQuestions', () => {
  it('returns true when the workflow has an open question of its own', () => {
    expect(
      workflowHasOpenQuestions({ questions: [q('q1', { workflowId: WF_A })], workflowId: WF_A }),
    ).toBe(true);
  });

  it('returns false when only OTHER workflows have open questions', () => {
    expect(
      workflowHasOpenQuestions({ questions: [q('q1', { workflowId: WF_B })], workflowId: WF_A }),
    ).toBe(false);
  });

  it('lets an unscoped question through, the same as the run gate', () => {
    expect(workflowHasOpenQuestions({ questions: [q('q1')], workflowId: WF_A })).toBe(false);
  });

  it('ignores answered and dismissed questions', () => {
    const questions = [
      q('q1', { workflowId: WF_A, status: 'answered' }),
      q('q2', { workflowId: WF_A, status: 'dismissed' }),
    ];
    expect(workflowHasOpenQuestions({ questions, workflowId: WF_A })).toBe(false);
  });

  it('returns false on an empty list', () => {
    expect(workflowHasOpenQuestions({ questions: [], workflowId: WF_A })).toBe(false);
  });
});

describe('workflowRunHasOpenQuestions', () => {
  it('returns true when the run has an open question of its own', () => {
    expect(
      workflowRunHasOpenQuestions({
        questions: [q('q1', { workflowRunId: RUN_A })],
        run: RUN_A_REF,
      }),
    ).toBe(true);
  });

  it('returns false when only ANOTHER run has open questions', () => {
    expect(
      workflowRunHasOpenQuestions({
        questions: [q('q1', { workflowRunId: RUN_B })],
        run: RUN_A_REF,
      }),
    ).toBe(false);
  });

  it('lets an orphan question from a free agent through instead of halting every run', () => {
    expect(workflowRunHasOpenQuestions({ questions: [q('q1')], run: RUN_A_REF })).toBe(false);
    expect(workflowRunHasOpenQuestions({ questions: [q('q1')], run: RUN_B_REF })).toBe(false);
  });

  it('blocks the run on a legacy question scoped to its workflow but not to a run', () => {
    const questions = [q('q1', { workflowId: WF_A })];
    expect(workflowRunHasOpenQuestions({ questions, run: RUN_A_REF })).toBe(true);
    expect(workflowRunHasOpenQuestions({ questions, run: RUN_B_REF })).toBe(false);
  });

  it('lets a question scoped to another run of the same workflow through', () => {
    const questions = [q('q1', { workflowId: WF_A, workflowRunId: RUN_B })];
    expect(workflowRunHasOpenQuestions({ questions, run: RUN_A_REF })).toBe(false);
  });

  it('ignores answered and dismissed questions of its own run', () => {
    const questions = [
      q('q1', { workflowRunId: RUN_A, status: 'answered' }),
      q('q2', { workflowRunId: RUN_A, status: 'dismissed' }),
    ];
    expect(workflowRunHasOpenQuestions({ questions, run: RUN_A_REF })).toBe(false);
  });
});

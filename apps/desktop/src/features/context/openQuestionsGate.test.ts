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
    userAnswer: null,
    status: 'open',
    createdAt: NOW,
    ...opts,
  };
}

describe('workflowHasOpenQuestions', () => {
  it('returns true when the workflow has an open question of its own', () => {
    expect(workflowHasOpenQuestions([q('q1', { workflowId: WF_A })], WF_A)).toBe(true);
  });

  it('returns false when only OTHER workflows have open questions', () => {
    expect(workflowHasOpenQuestions([q('q1', { workflowId: WF_B })], WF_A)).toBe(false);
  });

  it('orphan questions (no workflowId) block every workflow (safe legacy default)', () => {
    expect(workflowHasOpenQuestions([q('q1')], WF_A)).toBe(true);
    expect(workflowHasOpenQuestions([q('q1')], WF_B)).toBe(true);
  });

  it('ignores answered and dismissed questions', () => {
    const qs = [
      q('q1', { workflowId: WF_A, status: 'answered' }),
      q('q2', { workflowId: WF_A, status: 'dismissed' }),
    ];
    expect(workflowHasOpenQuestions(qs, WF_A)).toBe(false);
  });

  it('returns false on an empty list', () => {
    expect(workflowHasOpenQuestions([], WF_A)).toBe(false);
  });
});

describe('workflowRunHasOpenQuestions', () => {
  it('returns true when the run has an open question of its own', () => {
    expect(workflowRunHasOpenQuestions([q('q1', { workflowRunId: RUN_A })], RUN_A)).toBe(true);
  });

  it('returns false when only ANOTHER run has open questions', () => {
    expect(workflowRunHasOpenQuestions([q('q1', { workflowRunId: RUN_B })], RUN_A)).toBe(false);
  });

  it('lets an orphan question from a free agent through instead of halting every run', () => {
    expect(workflowRunHasOpenQuestions([q('q1')], RUN_A)).toBe(false);
    expect(workflowRunHasOpenQuestions([q('q1')], RUN_B)).toBe(false);
  });

  it('ignores answered and dismissed questions of its own run', () => {
    const qs = [
      q('q1', { workflowRunId: RUN_A, status: 'answered' }),
      q('q2', { workflowRunId: RUN_A, status: 'dismissed' }),
    ];
    expect(workflowRunHasOpenQuestions(qs, RUN_A)).toBe(false);
  });
});

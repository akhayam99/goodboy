import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  SessionId,
  WorkflowId,
} from '@goodboy/types';
import { hasOrphanOpenQuestions, workflowHasOpenQuestions } from './openQuestionsGate';

const NOW = '2026-05-26T00:00:00.000Z' as IsoDateTime;
const SESSION = 'sess_1' as SessionId;
const WF_A = 'wf_a' as WorkflowId;
const WF_B = 'wf_b' as WorkflowId;

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

describe('hasOrphanOpenQuestions', () => {
  it('detects an orphan question', () => {
    expect(hasOrphanOpenQuestions([q('q1')])).toBe(true);
  });

  it('rejects questions tied to any workflow', () => {
    expect(hasOrphanOpenQuestions([q('q1', { workflowId: WF_A })])).toBe(false);
  });

  it('ignores answered orphans', () => {
    expect(hasOrphanOpenQuestions([q('q1', { status: 'answered' })])).toBe(false);
  });
});

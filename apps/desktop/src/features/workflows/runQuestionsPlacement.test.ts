// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { OrchestratorPhase } from './orchestratorState';
import { runQuestionsPlacementOf } from './runQuestionsPlacement';

const BLOCKING = [{ isBlocking: true }, { isBlocking: false }];
const OPTIONAL = [{ isBlocking: false }];

const STOPPED: ReadonlyArray<OrchestratorPhase> = [
  'paused',
  'paused-budget',
  'failed',
  'stopped',
  'needs-approval',
  'plan-approval',
];

const OTHER: ReadonlyArray<OrchestratorPhase> = [
  'deciding',
  'stopping',
  'waiting',
  'automatic',
  'ready-first',
  'ready-mid',
  'plan-revising',
  'plan-question',
  'blocked',
  'step-failed',
  'done',
];

describe('runQuestionsPlacementOf', () => {
  it.each(STOPPED)('puts blocking questions before the %s state', (phase) => {
    expect(runQuestionsPlacementOf({ phase, questions: BLOCKING })).toBe('before-state');
  });

  it.each(STOPPED)('puts optional questions after the %s state', (phase) => {
    expect(runQuestionsPlacementOf({ phase, questions: OPTIONAL })).toBe('after-state');
  });

  it('keeps the waiting for an answer state first', () => {
    expect(runQuestionsPlacementOf({ phase: 'needs-answer', questions: BLOCKING })).toBe(
      'after-state',
    );
  });

  it.each(OTHER)('hides the questions in the %s phase', (phase) => {
    expect(runQuestionsPlacementOf({ phase, questions: BLOCKING })).toBe('hidden');
  });

  it('hides nothing when there are no questions', () => {
    expect(runQuestionsPlacementOf({ phase: 'paused-budget', questions: [] })).toBe('hidden');
  });
});

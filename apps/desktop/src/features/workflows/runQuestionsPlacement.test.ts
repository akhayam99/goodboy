// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { OrchestratorPhase } from './orchestratorState';
import {
  runQuestionsActionOf,
  runQuestionsHintOf,
  runQuestionsPlacementOf,
} from './runQuestionsPlacement';

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

describe('runQuestionsHintOf', () => {
  it.each([
    ['budget', 'Raise the limit to answer'],
    ['failure', 'Retry the run to answer'],
    ['operator', 'Continue the run to answer'],
    ['paused', 'Resume the run to answer'],
    ['needs-approval', 'Approve to answer'],
    ['plan-approval', 'Approve the plan to answer'],
    ['preset-change', 'Decide on the preset to answer'],
  ] as const)('names the way forward for a %s stop', (kind, hint) => {
    expect(runQuestionsHintOf({ stop: { kind, message: 'Paused for Northwind' } })).toBe(hint);
  });

  it('falls back to resume when the run carries no stop', () => {
    expect(runQuestionsHintOf({ stop: null })).toBe('Resume the run to answer');
  });
});

describe('runQuestionsActionOf', () => {
  it.each(['resume', 'raise-cap', 'continue', 'retry', 'review-plan', 'approve-plan'] as const)(
    'keeps the %s primary beside the questions',
    (kind) => {
      expect(runQuestionsActionOf({ primary: { kind, label: 'Go' } })?.kind).toBe(kind);
    },
  );

  it.each(['answer', 'hint', 'decide-next', 'start-step'] as const)(
    'drops the %s primary',
    (kind) => {
      expect(runQuestionsActionOf({ primary: { kind, label: 'Go' } })).toBeNull();
    },
  );

  it('returns nothing without a primary', () => {
    expect(runQuestionsActionOf({ primary: null })).toBeNull();
  });
});

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { WorkflowOrchestrationStop } from '@goodboy/types';
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
  'blocked',
  'step-failed',
  'done',
];

const PLAN_APPROVAL: WorkflowOrchestrationStop = { kind: 'plan-approval', message: 'Plan ready' };
const QUESTIONS: WorkflowOrchestrationStop = { kind: 'questions', message: 'Asked' };
const BUDGET: WorkflowOrchestrationStop = { kind: 'budget', message: 'Paused at the limit' };

describe('runQuestionsPlacementOf', () => {
  it.each(STOPPED)('puts blocking questions before the %s state', (phase) => {
    expect(runQuestionsPlacementOf({ phase, stop: null, questions: BLOCKING })).toBe(
      'before-state',
    );
  });

  it.each(STOPPED)('puts optional questions after the %s state', (phase) => {
    expect(runQuestionsPlacementOf({ phase, stop: null, questions: OPTIONAL })).toBe('after-state');
  });

  it('keeps the waiting for an answer state first', () => {
    expect(
      runQuestionsPlacementOf({ phase: 'needs-answer', stop: QUESTIONS, questions: BLOCKING }),
    ).toBe('after-state');
  });

  it.each(OTHER)('hides the questions in the %s phase with no stop', (phase) => {
    expect(runQuestionsPlacementOf({ phase, stop: null, questions: BLOCKING })).toBe('hidden');
  });

  it.each(['plan-question', 'plan-revising'] as const)(
    'leaves the questions to the planner tail in the %s phase while the run holds a plan-approval stop',
    (phase) => {
      expect(runQuestionsPlacementOf({ phase, stop: PLAN_APPROVAL, questions: BLOCKING })).toBe(
        'hidden',
      );
    },
  );

  it.each(['plan-question', 'plan-revising'] as const)(
    'hides the questions in the %s phase without a stop',
    (phase) => {
      expect(runQuestionsPlacementOf({ phase, stop: null, questions: BLOCKING })).toBe('hidden');
    },
  );

  it('puts the questions of a preset run stopped for another reason before the stop line', () => {
    expect(runQuestionsPlacementOf({ phase: null, stop: BUDGET, questions: BLOCKING })).toBe(
      'before-state',
    );
    expect(runQuestionsPlacementOf({ phase: null, stop: BUDGET, questions: OPTIONAL })).toBe(
      'after-state',
    );
  });

  it('keeps the questions of a preset run with no stop after the answer line', () => {
    expect(runQuestionsPlacementOf({ phase: null, stop: null, questions: BLOCKING })).toBe(
      'after-state',
    );
  });

  it('hides nothing when there are no questions', () => {
    expect(runQuestionsPlacementOf({ phase: 'paused-budget', stop: BUDGET, questions: [] })).toBe(
      'hidden',
    );
  });
});

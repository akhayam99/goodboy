// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { WorkflowOrchestrationStopKind } from '@goodboy/types';
import { runQuestionsActionOf } from './runQuestionsActionOf';

const stopOf = (kind: WorkflowOrchestrationStopKind) => ({
  kind,
  message: 'Stopped for Northwind',
});

describe('runQuestionsActionOf', () => {
  it.each([
    ['budget', 'raise-cap'],
    ['failure', 'retry'],
    ['operator', 'continue'],
    ['paused', 'resume'],
    ['closed', 'resume'],
  ] as const)('names the %s stop action whatever the primary is', (kind, action) => {
    expect(runQuestionsActionOf({ stop: stopOf(kind), primary: null })?.kind).toBe(action);
    expect(
      runQuestionsActionOf({ stop: stopOf(kind), primary: { kind: 'start-step', label: 'Go' } })
        ?.kind,
    ).toBe(action);
  });

  it.each(['review-plan', 'approve-plan'] as const)(
    'keeps the %s primary on a plan approval stop',
    (kind) => {
      expect(
        runQuestionsActionOf({ stop: stopOf('plan-approval'), primary: { kind, label: 'Go' } })
          ?.kind,
      ).toBe(kind);
    },
  );

  it.each(['questions', 'needs-approval', 'preset-change'] as const)(
    'offers nothing on a %s stop',
    (kind) => {
      expect(
        runQuestionsActionOf({ stop: stopOf(kind), primary: { kind: 'resume', label: 'Go' } }),
      ).toBeNull();
    },
  );

  it('offers nothing without a stop', () => {
    expect(runQuestionsActionOf({ stop: undefined, primary: null })).toBeNull();
  });
});

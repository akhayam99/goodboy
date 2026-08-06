import { describe, expect, it } from 'vitest';
import type { Step, StepId, WorkflowId } from '@goodboy/types';
import { viewWorkflowAdvance } from './workflowAdvanceView';

const step: Step = {
  id: 's1' as StepId,
  workflowId: 'wf-1' as WorkflowId,
  ordinal: 0,
  name: 'Scout',
  promptPrefix: '',
};

describe('viewWorkflowAdvance', () => {
  it('exposes nothing when the run is complete', () => {
    expect(viewWorkflowAdvance({ state: { kind: 'complete' } })).toEqual({
      pendingStep: null,
      manualStep: null,
      failedStep: null,
      blockReason: null,
    });
  });

  it('offers a pending step but no manual click when autorun owns the advance', () => {
    expect(viewWorkflowAdvance({ state: { kind: 'automatic', step } })).toEqual({
      pendingStep: step,
      manualStep: null,
      failedStep: null,
      blockReason: null,
    });
  });

  it('offers both a pending step and a manual click when ready', () => {
    expect(viewWorkflowAdvance({ state: { kind: 'ready', step } })).toEqual({
      pendingStep: step,
      manualStep: step,
      failedStep: null,
      blockReason: null,
    });
  });

  it('names the failed step and drops the pending step when a step failed', () => {
    expect(
      viewWorkflowAdvance({ state: { kind: 'blocked', reason: 'failed-step', step } }),
    ).toEqual({
      pendingStep: null,
      manualStep: null,
      failedStep: step,
      blockReason: 'failed-step',
    });
  });

  it('keeps the pending step for a transient block so callers can force it', () => {
    expect(viewWorkflowAdvance({ state: { kind: 'blocked', reason: 'questions', step } })).toEqual({
      pendingStep: step,
      manualStep: null,
      failedStep: null,
      blockReason: 'questions',
    });
  });

  it('keeps the pending step while a turn is still running', () => {
    expect(
      viewWorkflowAdvance({ state: { kind: 'blocked', reason: 'turn-running', step } }),
    ).toEqual({
      pendingStep: step,
      manualStep: null,
      failedStep: null,
      blockReason: 'turn-running',
    });
  });
});

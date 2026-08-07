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
      chainStep: null,
      manualStep: null,
      failedStep: null,
      blockReason: null,
    });
  });

  it('offers a chain step but no manual click when autorun owns the advance', () => {
    expect(viewWorkflowAdvance({ state: { kind: 'automatic', step } })).toEqual({
      chainStep: step,
      manualStep: null,
      failedStep: null,
      blockReason: null,
    });
  });

  it('offers both a chain step and a manual click when ready', () => {
    expect(viewWorkflowAdvance({ state: { kind: 'ready', step } })).toEqual({
      chainStep: step,
      manualStep: step,
      failedStep: null,
      blockReason: null,
    });
  });

  it('names the failed step and drops the chain step when a step failed', () => {
    expect(
      viewWorkflowAdvance({
        state: { kind: 'blocked', reason: 'failed-step', step, failedStep: step },
      }),
    ).toEqual({
      chainStep: null,
      manualStep: null,
      failedStep: step,
      blockReason: 'failed-step',
    });
  });

  it('keeps the chain step for a transient block so callers can force it', () => {
    expect(
      viewWorkflowAdvance({
        state: { kind: 'blocked', reason: 'questions', step, failedStep: null },
      }),
    ).toEqual({
      chainStep: step,
      manualStep: null,
      failedStep: null,
      blockReason: 'questions',
    });
  });

  it('keeps the chain step while a turn is still running', () => {
    expect(
      viewWorkflowAdvance({
        state: { kind: 'blocked', reason: 'turn-running', step, failedStep: null },
      }),
    ).toEqual({
      chainStep: step,
      manualStep: null,
      failedStep: null,
      blockReason: 'turn-running',
    });
  });

  it('still names the failed step when an open question owns the reason', () => {
    expect(
      viewWorkflowAdvance({
        state: { kind: 'blocked', reason: 'questions', step, failedStep: step },
      }),
    ).toEqual({
      chainStep: null,
      manualStep: null,
      failedStep: step,
      blockReason: 'questions',
    });
  });

  it('still names the failed step while the summarizer owns the reason', () => {
    expect(
      viewWorkflowAdvance({
        state: { kind: 'blocked', reason: 'summarizer', step, failedStep: step },
      }),
    ).toEqual({
      chainStep: null,
      manualStep: null,
      failedStep: step,
      blockReason: 'summarizer',
    });
  });
});

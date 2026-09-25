import { describe, expect, it } from 'vitest';
import { workflowStartGate } from './workflowStartGate';

const ready = {
  mode: 'preset',
  isStarting: false,
  isPlanning: false,
  hasGoal: true,
  hasSteps: true,
  isSpendLimitValid: true,
} as const;

describe('workflowStartGate', () => {
  it('enables start with no reason left to show', () => {
    expect(workflowStartGate(ready)).toEqual({ isDisabled: false, reason: null });
  });

  it('names the reason for every blocker, never leaving start mute', () => {
    const blockers = [
      { ...ready, isStarting: true },
      { ...ready, isPlanning: true },
      { ...ready, hasGoal: false },
      { ...ready, hasSteps: false },
      { ...ready, isSpendLimitValid: false },
    ];

    for (const params of blockers) {
      const gate = workflowStartGate(params);
      expect(gate.isDisabled).toBe(true);
      expect(gate.reason).not.toBeNull();
    }
  });

  it('speaks the steps language of the selected mode', () => {
    expect(workflowStartGate({ ...ready, mode: 'preset', hasSteps: false }).reason).toBe(
      'Select a preset to start',
    );
    expect(workflowStartGate({ ...ready, mode: 'custom', hasSteps: false }).reason).toBe(
      'Add a step or generate a plan to start',
    );
  });

  it('starts an orchestrated run from the goal alone', () => {
    expect(workflowStartGate({ ...ready, mode: 'dynamic', hasSteps: false })).toEqual({
      isDisabled: false,
      reason: null,
    });
  });

  it('keeps an invalid spend limit from starting a run in silence', () => {
    expect(workflowStartGate({ ...ready, mode: 'dynamic', isSpendLimitValid: false })).toEqual({
      isDisabled: true,
      reason: 'Enter a valid spend limit to start',
    });
  });

  it('puts work in flight ahead of the fields still to fill', () => {
    expect(workflowStartGate({ ...ready, isStarting: true, hasGoal: false }).reason).toBe(
      'This workflow is already starting',
    );
  });
});

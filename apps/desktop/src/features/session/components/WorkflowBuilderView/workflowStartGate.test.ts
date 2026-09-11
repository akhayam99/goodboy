import { describe, expect, it } from 'vitest';
import { workflowStartGate } from './workflowStartGate';

const ready = {
  mode: 'preset',
  isStarting: false,
  isPlanning: false,
  hasGoal: true,
  hasApproach: true,
  hasName: true,
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
      { ...ready, hasApproach: false },
      { ...ready, hasName: false },
      { ...ready, isSpendLimitValid: false },
    ];

    for (const params of blockers) {
      const gate = workflowStartGate(params);
      expect(gate.isDisabled).toBe(true);
      expect(gate.reason).not.toBeNull();
    }
  });

  it('speaks the approach language of the selected mode', () => {
    expect(workflowStartGate({ ...ready, mode: 'preset', hasApproach: false }).reason).toBe(
      'Select a preset to start',
    );
    expect(workflowStartGate({ ...ready, mode: 'custom', hasApproach: false }).reason).toBe(
      'Add a step or generate a plan to start',
    );
    expect(workflowStartGate({ ...ready, mode: 'dynamic', hasApproach: false }).reason).toBe(
      'Describe the intent and constraints to start',
    );
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

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type AgentId, type StepId, type WorkflowRunId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { runOnScreenOf } from './runOnScreenOf';

const step = anAgent({
  id: brandId<AgentId>({ value: 'agent-step' }),
  workflowRunId: brandId<WorkflowRunId>({ value: 'run-b' }),
  stepId: brandId<StepId>({ value: 'step-1' }),
});
const child = anAgent({ id: brandId<AgentId>({ value: 'agent-child' }), parentAgentId: step.id });
const loose = anAgent({ id: brandId<AgentId>({ value: 'agent-loose' }) });

describe('runOnScreenOf', () => {
  it('keeps the focused run', () => {
    expect(runOnScreenOf({ focusedRunId: 'run-a', selectedAgentId: step.id, agents: [step] })).toBe(
      'run-a',
    );
  });

  it('reads the run of the step page when no run is focused', () => {
    expect(runOnScreenOf({ focusedRunId: null, selectedAgentId: step.id, agents: [step] })).toBe(
      'run-b',
    );
  });

  it('climbs from a sub-agent to the run of its step', () => {
    expect(
      runOnScreenOf({ focusedRunId: null, selectedAgentId: child.id, agents: [step, child] }),
    ).toBe('run-b');
  });

  it('has no run for a plain agent or no agent', () => {
    expect(
      runOnScreenOf({ focusedRunId: null, selectedAgentId: loose.id, agents: [loose] }),
    ).toBeNull();
    expect(runOnScreenOf({ focusedRunId: null, selectedAgentId: null, agents: [step] })).toBeNull();
  });
});

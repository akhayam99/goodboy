// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AgentId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { runOnScreenOf } from './runOnScreenOf';

const step = anAgent({ id: 'agent-step' as AgentId, workflowRunId: 'run-b', stepId: 'step-1' });
const child = anAgent({ id: 'agent-child' as AgentId, parentAgentId: step.id });
const loose = anAgent({ id: 'agent-loose' as AgentId });

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

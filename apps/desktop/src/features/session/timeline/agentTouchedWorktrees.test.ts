import { describe, expect, it } from 'vitest';
import type { AgentId, MeasuredTurnSpan, MountId } from '@goodboy/types';
import { agentTouchedWorktrees } from './agentTouchedWorktrees';

const span = (
  agentId: string,
  touchedMountIds: ReadonlyArray<string> | null,
): MeasuredTurnSpan => ({
  agentId: agentId as AgentId,
  parentAgentId: null,
  agentStatus: 'completed',
  workflowRunId: null,
  isOrchestratedRunDone: false,
  stepRole: 'implementer',
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: null,
  startedAtMs: 0,
  endedAtMs: 60_000,
  endReason: 'succeeded',
  costUsd: null,
  touchedMountIds: touchedMountIds as ReadonlyArray<MountId> | null,
});

const worktrees = [
  { mountId: 'mount-web' as MountId, label: 'acme-web' },
  { mountId: 'mount-api' as MountId, label: 'acme-api' },
];

describe('agentTouchedWorktrees', () => {
  it('joins every turn of an agent in the order the session lists its worktrees', () => {
    const touched = agentTouchedWorktrees({
      spans: [span('agent-1', ['mount-api']), span('agent-1', ['mount-web', 'mount-api'])],
      worktrees,
    });

    expect(touched.get('agent-1')).toEqual(['acme-web', 'acme-api']);
  });

  it('leaves out agents that changed nothing or ran before turns were recorded', () => {
    const touched = agentTouchedWorktrees({
      spans: [span('agent-1', []), span('agent-2', null)],
      worktrees,
    });

    expect(touched.size).toBe(0);
  });

  it('drops a worktree the session no longer has', () => {
    const touched = agentTouchedWorktrees({
      spans: [span('agent-1', ['mount-gone'])],
      worktrees,
    });

    expect(touched.has('agent-1')).toBe(false);
  });
});

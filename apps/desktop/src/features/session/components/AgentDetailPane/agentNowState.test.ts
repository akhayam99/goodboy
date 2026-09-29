import { describe, expect, it } from 'vitest';
import type { Agent } from '@goodboy/types';
import { agentNowState, effectiveAgentStatus } from './agentNowState';

const agent = { id: 'agent-1', status: 'running' } as unknown as Agent;

describe('agentNowState', () => {
  it('reads a running agent as running before any turn state arrives', () => {
    const now = agentNowState({ agent, turnState: null, transcript: [] });

    expect(now.tone).toBe('info');
    expect(now.isPulsing).toBe(true);
    expect(effectiveAgentStatus({ agent, turnState: null })).toBe('running');
  });

  it('lets a live turn win over a finished agent row', () => {
    const finished = { ...agent, status: 'completed' } as Agent;

    expect(effectiveAgentStatus({ agent: finished, turnState: { kind: 'running' } as never })).toBe(
      'running',
    );
  });

  it('reads a failed agent without a turn error as failed, not ready', () => {
    const failed = { ...agent, status: 'failed' } as Agent;

    const now = agentNowState({ agent: failed, turnState: null, transcript: [] });

    expect(now.label).toBe('failed');
    expect(now.tone).toBe('danger');
  });

  it('reads a stopped agent as stopped, the word the hand-off chip uses', () => {
    const stopped = { ...agent, status: 'stopped' } as Agent;

    expect(agentNowState({ agent: stopped, turnState: null, transcript: [] }).label).toBe(
      'stopped',
    );
  });

  it('reads a starting turn as starting, not ready', () => {
    const idle = { ...agent, status: 'completed' } as Agent;

    const now = agentNowState({
      agent: idle,
      turnState: { kind: 'starting', startedAt: '2026-09-29T09:00:00.000Z' } as never,
      transcript: [],
    });

    expect(now.label).toBe('starting');
  });
});

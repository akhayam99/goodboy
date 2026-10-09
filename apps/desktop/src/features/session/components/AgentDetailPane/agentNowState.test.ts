// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Agent } from '@goodboy/types';
import { agentNowState, effectiveAgentStatus } from './agentNowState';

const agent = { id: 'agent-1', status: 'running' } as unknown as Agent;

describe('agentNowState', () => {
  it('reads a running agent as running before any turn state arrives', () => {
    const now = agentNowState({ agent, turnState: null, transcript: [] });

    expect(now.label).toBe('thinking');
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

  it('never reads a running agent whose turn is not live as ready', () => {
    const idle = { kind: 'idle', lastActivityAt: '2026-09-29T09:00:00.000Z' } as never;

    expect(agentNowState({ agent, turnState: idle, transcript: [] }).label).toBeNull();
    expect(agentNowState({ agent, turnState: idle, transcript: [], activeChildren: 0 }).label).toBe(
      null,
    );
  });

  it('names the subagents a running agent waits on while its own turn is not live', () => {
    const idle = { kind: 'idle', lastActivityAt: '2026-09-29T09:00:00.000Z' } as never;

    expect(agentNowState({ agent, turnState: idle, transcript: [], activeChildren: 1 }).label).toBe(
      'Waiting on 1 subagent',
    );
    expect(agentNowState({ agent, turnState: idle, transcript: [], activeChildren: 3 }).label).toBe(
      'Waiting on 3 subagents',
    );
  });

  it('keeps ready for an agent that is not running', () => {
    const done = { ...agent, status: 'completed' } as Agent;

    expect(agentNowState({ agent: done, turnState: null, transcript: [] }).label).toBe('ready');
  });
});

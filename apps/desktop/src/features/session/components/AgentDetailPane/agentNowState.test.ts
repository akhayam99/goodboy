// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Agent, TurnState } from '@goodboy/types';
import { TEST_NOW, anAgent } from '@goodboy/types/testing';
import { agentNowState, effectiveAgentStatus } from './agentNowState';

const agent = { id: 'agent-1', status: 'running' } as unknown as Agent;

const IDLE: TurnState = { kind: 'idle', lastActivityAt: TEST_NOW };

describe('agentNowState', () => {
  it('reads a running agent as running before any turn state arrives', () => {
    const now = agentNowState({ agent, turnState: null, transcript: [] });

    expect(now.label).toBe('thinking');
    expect(effectiveAgentStatus({ agent, turnState: null })).toBe('running');
  });

  it('reads an agent that waits for another writer as waiting for the writer', () => {
    const waiting = anAgent({ status: 'pending' });

    const now = agentNowState({
      agent: waiting,
      turnState: { kind: 'starting', startedAt: TEST_NOW },
      transcript: [],
      isWaitingForWriter: true,
    });

    expect(now.label).toBe('waiting for the writer');
  });

  it('lets a live turn win over a finished agent row', () => {
    const finished = { ...agent, status: 'completed' } as Agent;

    expect(effectiveAgentStatus({ agent: finished, turnState: { kind: 'running' } as never })).toBe(
      'running',
    );
  });

  it('reads a turn error in plain words, not as the raw message', () => {
    const now = agentNowState({
      agent: { ...agent, providerSessionProviderId: 'anthropic' },
      turnState: { kind: 'error', message: 'Error: 429 Too Many Requests', failedAt: TEST_NOW },
      transcript: [],
    });

    expect(now.label).toBe('Claude is limiting requests right now. Wait a moment, then retry.');
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
    expect(agentNowState({ agent, turnState: IDLE, transcript: [] }).label).toBeNull();
  });

  it('keeps ready for an agent that is not running', () => {
    const done: Agent = anAgent({ status: 'completed' });

    expect(agentNowState({ agent: done, turnState: null, transcript: [] }).label).toBe('ready');
  });
});

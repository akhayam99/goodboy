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
});

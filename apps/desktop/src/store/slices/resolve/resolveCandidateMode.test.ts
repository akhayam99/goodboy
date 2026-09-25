import { describe, expect, it } from 'vitest';
import type { Agent } from '@goodboy/types';
import { hasOtherLiveWriter, resolveCandidateMode } from './resolveCandidateMode';

type AgentSeed = {
  readonly id: string;
  readonly status: Agent['status'];
  readonly doneAt?: string | null;
};

const agent = ({ id, status, doneAt = null }: AgentSeed): Agent =>
  ({ id, status, doneAt }) as unknown as Agent;

const RESOLVER = agent({ id: 'resolver', status: 'running' });

describe('resolveCandidateMode', () => {
  it('proposes while a workflow agent writes the branch', () => {
    expect(
      resolveCandidateMode({
        agents: [RESOLVER, agent({ id: 'implementer', status: 'running' })],
        resolverId: 'resolver',
        isOperatorTurn: false,
      }),
    ).toBe('propose');
  });

  it('applies once no other agent is running', () => {
    expect(
      resolveCandidateMode({
        agents: [RESOLVER, agent({ id: 'implementer', status: 'completed' })],
        resolverId: 'resolver',
        isOperatorTurn: false,
      }),
    ).toBe('apply');
  });

  it('applies a direct instruction from the resolver chat even while a workflow runs', () => {
    expect(
      resolveCandidateMode({
        agents: [RESOLVER, agent({ id: 'implementer', status: 'running' })],
        resolverId: 'resolver',
        isOperatorTurn: true,
      }),
    ).toBe('apply');
  });
});

describe('hasOtherLiveWriter', () => {
  it('ignores the resolver itself and parked agents', () => {
    expect(
      hasOtherLiveWriter({
        agents: [
          RESOLVER,
          agent({ id: 'parked', status: 'running', doneAt: '2026-09-25T00:00:00.000Z' }),
          agent({ id: 'waiting', status: 'pending' }),
        ],
        resolverId: 'resolver',
      }),
    ).toBe(false);
  });
});

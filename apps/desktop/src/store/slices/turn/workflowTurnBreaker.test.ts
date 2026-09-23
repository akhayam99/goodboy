import { beforeEach, describe, expect, it } from 'vitest';
import type { AgentId } from '@goodboy/types';
import {
  claimWorkflowTurn,
  clearWorkflowTurns,
  MAX_UNATTENDED_TURNS_PER_AGENT,
  resetWorkflowTurnBreaker,
  UNATTENDED_WINDOW_MS,
} from './workflowTurnBreaker';

const AGENT_ID = 'agent-1' as AgentId;
const OTHER_ID = 'agent-2' as AgentId;
const T0 = 1_000_000;

const claimMany = (count: number, agentId: AgentId = AGENT_ID, nowMs = T0) =>
  Array.from({ length: count }, (_, i) => claimWorkflowTurn({ agentId, nowMs: nowMs + i }));

beforeEach(() => {
  resetWorkflowTurnBreaker();
});

describe('workflowTurnBreaker', () => {
  it('grants workflow turns up to the cap', () => {
    expect(claimMany(MAX_UNATTENDED_TURNS_PER_AGENT)).toEqual(
      Array(MAX_UNATTENDED_TURNS_PER_AGENT).fill('granted'),
    );
  });

  it('trips on the first turn past the cap and keeps tripping', () => {
    claimMany(MAX_UNATTENDED_TURNS_PER_AGENT);
    expect(claimWorkflowTurn({ agentId: AGENT_ID, nowMs: T0 + 100 })).toBe('tripped');
    expect(claimWorkflowTurn({ agentId: AGENT_ID, nowMs: T0 + 200 })).toBe('tripped');
  });

  it('counts each agent on its own', () => {
    claimMany(MAX_UNATTENDED_TURNS_PER_AGENT);
    expect(claimWorkflowTurn({ agentId: OTHER_ID, nowMs: T0 })).toBe('granted');
  });

  it('grants again once an operator turn clears the agent', () => {
    claimMany(MAX_UNATTENDED_TURNS_PER_AGENT);
    clearWorkflowTurns({ agentId: AGENT_ID });
    expect(claimWorkflowTurn({ agentId: AGENT_ID, nowMs: T0 + 100 })).toBe('granted');
  });

  it('forgets turns older than the window', () => {
    claimMany(MAX_UNATTENDED_TURNS_PER_AGENT);
    expect(
      claimWorkflowTurn({
        agentId: AGENT_ID,
        nowMs: T0 + MAX_UNATTENDED_TURNS_PER_AGENT + UNATTENDED_WINDOW_MS,
      }),
    ).toBe('granted');
  });
});

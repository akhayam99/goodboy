import { describe, expect, it } from 'vitest';
import type { AgentId } from '@goodboy/types';
import {
  SETTLE_CEILING_MS,
  isTurnSettling,
  markTurnActive,
  markTurnSettled,
  waitTurnSettled,
} from './turnSettled';

const AGENT_ID = 'agent-settled' as AgentId;

describe('turnSettled', () => {
  it('reports an unmarked agent as not settling', () => {
    expect(isTurnSettling({ agentId: AGENT_ID, nowMs: 0 })).toBe(false);
  });

  it('reports a marked agent as settling until the ceiling after the process was first seen gone', () => {
    markTurnActive({ agentId: AGENT_ID });
    try {
      expect(isTurnSettling({ agentId: AGENT_ID, nowMs: 1_000 })).toBe(true);
      expect(isTurnSettling({ agentId: AGENT_ID, nowMs: 1_000 + SETTLE_CEILING_MS - 1 })).toBe(
        true,
      );
      expect(isTurnSettling({ agentId: AGENT_ID, nowMs: 1_000 + SETTLE_CEILING_MS })).toBe(false);
    } finally {
      markTurnSettled({ agentId: AGENT_ID });
    }
  });

  it('restarts the ceiling when a new turn marks the agent active again', () => {
    markTurnActive({ agentId: AGENT_ID });
    try {
      expect(isTurnSettling({ agentId: AGENT_ID, nowMs: 0 })).toBe(true);
      expect(isTurnSettling({ agentId: AGENT_ID, nowMs: SETTLE_CEILING_MS + 1 })).toBe(false);
      markTurnActive({ agentId: AGENT_ID });
      expect(isTurnSettling({ agentId: AGENT_ID, nowMs: SETTLE_CEILING_MS + 2 })).toBe(true);
    } finally {
      markTurnSettled({ agentId: AGENT_ID });
      markTurnSettled({ agentId: AGENT_ID });
    }
  });

  it('clears the mark and wakes waiters once every turn settled', async () => {
    markTurnActive({ agentId: AGENT_ID });
    markTurnActive({ agentId: AGENT_ID });
    const waiting = waitTurnSettled({ agentId: AGENT_ID });
    markTurnSettled({ agentId: AGENT_ID });
    expect(isTurnSettling({ agentId: AGENT_ID, nowMs: 0 })).toBe(true);
    markTurnSettled({ agentId: AGENT_ID });
    await waiting;
    expect(isTurnSettling({ agentId: AGENT_ID, nowMs: 0 })).toBe(false);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import type { AgentId } from '@goodboy/types';
import {
  cancelTurnStartWindow,
  claimTurnStart,
  closeTurnStartWindow,
  isTurnStartCancelled,
  openTurnStartWindow,
  resetTurnStartWindows,
} from './turnStartWindow';

const AGENT_ID = 'agent-1' as AgentId;

beforeEach(() => {
  resetTurnStartWindows();
});

describe('turnStartWindow', () => {
  it('grants a start nobody cancelled', () => {
    openTurnStartWindow({ agentId: AGENT_ID });
    expect(claimTurnStart({ agentId: AGENT_ID })).toBe('granted');
  });

  it('refuses a start cancelled while the turn was still queued', () => {
    openTurnStartWindow({ agentId: AGENT_ID });
    expect(cancelTurnStartWindow({ agentId: AGENT_ID })).toBe(true);
    expect(isTurnStartCancelled({ agentId: AGENT_ID })).toBe(true);
    expect(claimTurnStart({ agentId: AGENT_ID })).toBe('cancelled');
  });

  it('refuses that start once, so the next turn on the agent is granted', () => {
    openTurnStartWindow({ agentId: AGENT_ID });
    cancelTurnStartWindow({ agentId: AGENT_ID });
    expect(claimTurnStart({ agentId: AGENT_ID })).toBe('cancelled');
    expect(claimTurnStart({ agentId: AGENT_ID })).toBe('granted');
  });

  it('cancels nothing when no turn is waiting to start', () => {
    expect(cancelTurnStartWindow({ agentId: AGENT_ID })).toBe(false);
    expect(claimTurnStart({ agentId: AGENT_ID })).toBe('granted');
  });

  it('forgets a window the turn already closed', () => {
    openTurnStartWindow({ agentId: AGENT_ID });
    closeTurnStartWindow({ agentId: AGENT_ID });
    expect(cancelTurnStartWindow({ agentId: AGENT_ID })).toBe(false);
  });
});

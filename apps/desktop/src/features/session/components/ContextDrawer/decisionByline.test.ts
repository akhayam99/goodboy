import { describe, expect, it } from 'vitest';
import type { AgentId, IsoDateTime, SessionDecision, SessionId } from '@goodboy/types';
import { activeDecisionByline, closedDecisionByline, isAfterBaseline } from './decisionByline';

const AT = '2026-09-26T10:00:00.000Z' as IsoDateTime;
const NOW_MS = Date.parse('2026-09-26T11:00:00.000Z');
const NAMES = new Map([['implementer' as AgentId, 'Implementer']]);

const decision = (overrides: Partial<SessionDecision>): SessionDecision => ({
  id: 'd',
  sessionId: 'session' as SessionId,
  number: 9,
  text: 'Show the banner after the third failed retry',
  status: 'active',
  replacedBy: null,
  author: 'agent',
  agentId: 'implementer' as AgentId,
  turnOrdinal: 14,
  reason: null,
  closedBy: null,
  closedByAgentId: null,
  previousText: null,
  rewordedAt: null,
  createdAt: AT,
  updatedAt: AT,
  ...overrides,
});

describe('decision bylines', () => {
  it('names the agent, its turn, the age and what it replaced', () => {
    expect(
      activeDecisionByline({
        decision: decision({}),
        agentNames: NAMES,
        replaces: 5,
        nowMs: NOW_MS,
      }),
    ).toBe('Implementer · turn 14 · 1h · replaces 5');
  });

  it('keeps your own decisions to you and the age', () => {
    expect(
      activeDecisionByline({
        decision: decision({ author: 'user', agentId: null, turnOrdinal: null }),
        agentNames: NAMES,
        replaces: null,
        nowMs: NOW_MS,
      }),
    ).toBe('You · 1h');
  });

  it('tells a replacement from a merge and a withdrawal', () => {
    const closer = { closedBy: 'agent' as const, closedByAgentId: 'implementer' as AgentId };
    expect(
      closedDecisionByline({
        decision: decision({
          number: 5,
          author: 'user',
          status: 'replaced',
          replacedBy: 9,
          ...closer,
        }),
        agentNames: NAMES,
      }),
    ).toEqual({ author: 'You', verb: 'replaced by', target: 9, closer: 'Implementer' });
    expect(
      closedDecisionByline({
        decision: decision({
          number: 3,
          status: 'replaced',
          replacedBy: 1,
          closedBy: 'summarizer',
        }),
        agentNames: NAMES,
      }),
    ).toMatchObject({ verb: 'merged into', target: 1, closer: 'Goodboy' });
    expect(
      closedDecisionByline({
        decision: decision({ status: 'withdrawn', ...closer }),
        agentNames: NAMES,
      }),
    ).toMatchObject({ verb: 'withdrawn', target: null });
  });

  it('marks only what came after a known last look', () => {
    expect(isAfterBaseline({ iso: AT, baseline: '2026-09-26T09:00:00.000Z' })).toBe(true);
    expect(isAfterBaseline({ iso: AT, baseline: '2026-09-26T10:30:00.000Z' })).toBe(false);
    expect(isAfterBaseline({ iso: AT, baseline: null })).toBe(false);
  });
});

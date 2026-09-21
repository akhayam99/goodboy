import { describe, expect, it } from 'vitest';
import { allocateReportContext, REPORT_ALLOCATION_LIMITS } from './allocateReportContext';

const TOTAL_CAP = 48_000;

describe('allocateReportContext reservations', () => {
  it('returns unused framing, truncation and evidence reservations to the agent pool', () => {
    const allocation = allocateReportContext({
      totalCap: TOTAL_CAP,
      usage: { framingUsed: 1_000, truncationNotesUsed: 100, evidenceUsed: 500 },
      agents: [],
    });
    expect(allocation.agentPool).toBe(TOTAL_CAP - 1_000 - 100 - 500);
  });

  it('never reserves more than the declared maximum for a bucket that overshoots it', () => {
    const allocation = allocateReportContext({
      totalCap: TOTAL_CAP,
      usage: {
        framingUsed: REPORT_ALLOCATION_LIMITS.framing + 4_000,
        truncationNotesUsed: 0,
        evidenceUsed: 0,
      },
      agents: [],
    });
    expect(allocation.agentPool).toBe(TOTAL_CAP - REPORT_ALLOCATION_LIMITS.framing);
  });
});

describe('allocateReportContext agent budgets', () => {
  it('gives the most recent final message everything it needs before expanding an older one', () => {
    const allocation = allocateReportContext({
      totalCap: TOTAL_CAP,
      usage: { framingUsed: 0, truncationNotesUsed: 0, evidenceUsed: 0 },
      agents: [
        { id: 'older', ordinal: 0, lastAssistantAt: '2026-09-01T00:00:00.000Z', textLength: 1_000 },
        {
          id: 'newest',
          ordinal: 1,
          lastAssistantAt: '2026-09-02T00:00:00.000Z',
          textLength: 5_000,
        },
      ],
    });
    const byId = new Map(allocation.agents.map((agent) => [agent.id, agent.budget]));
    expect(byId.get('newest')).toBe(5_000);
    expect(byId.get('older')).toBe(1_000);
  });

  it('caps an older message at the reserve when the pool cannot expand it further', () => {
    const allocation = allocateReportContext({
      totalCap: 2_600,
      usage: { framingUsed: 0, truncationNotesUsed: 0, evidenceUsed: 0 },
      agents: [
        { id: 'older', ordinal: 0, lastAssistantAt: '2026-09-01T00:00:00.000Z', textLength: 1_000 },
        {
          id: 'newest',
          ordinal: 1,
          lastAssistantAt: '2026-09-02T00:00:00.000Z',
          textLength: 5_000,
        },
      ],
    });
    const byId = new Map(allocation.agents.map((agent) => [agent.id, agent.budget]));
    expect(byId.get('older')).toBe(REPORT_ALLOCATION_LIMITS.olderAgentReserve);
    expect(byId.get('newest')).toBe(2_600 - REPORT_ALLOCATION_LIMITS.olderAgentReserve);
  });

  it('orders by the last assistant timestamp, not by ordinal, so a rerun of an earlier ordinal wins', () => {
    const allocation = allocateReportContext({
      totalCap: TOTAL_CAP,
      usage: { framingUsed: 0, truncationNotesUsed: 0, evidenceUsed: 0 },
      agents: [
        {
          id: 'stale-high-ordinal',
          ordinal: 5,
          lastAssistantAt: '2026-01-01T00:00:00.000Z',
          textLength: 2_000,
        },
        {
          id: 'fresh-rerun',
          ordinal: 2,
          lastAssistantAt: '2026-02-01T00:00:00.000Z',
          textLength: 2_000,
        },
      ],
    });
    expect(allocation.agents[0]?.id).toBe('fresh-rerun');
  });

  it('breaks a timestamp tie deterministically by ordinal then id', () => {
    const agents = [
      { id: 'b', ordinal: 3, lastAssistantAt: '2026-09-01T00:00:00.000Z', textLength: 100 },
      { id: 'a', ordinal: 3, lastAssistantAt: '2026-09-01T00:00:00.000Z', textLength: 100 },
      { id: 'z', ordinal: 1, lastAssistantAt: '2026-09-01T00:00:00.000Z', textLength: 100 },
    ];
    const first = allocateReportContext({
      totalCap: 500,
      usage: { framingUsed: 0, truncationNotesUsed: 0, evidenceUsed: 0 },
      agents,
    });
    const second = allocateReportContext({
      totalCap: 500,
      usage: { framingUsed: 0, truncationNotesUsed: 0, evidenceUsed: 0 },
      agents: [...agents].reverse(),
    });
    expect(first.agents.map((agent) => agent.id)).toEqual(['a', 'b', 'z']);
    expect(second.agents.map((agent) => agent.id)).toEqual(['a', 'b', 'z']);
  });

  it('never allocates more than the agent pool across all agents', () => {
    const allocation = allocateReportContext({
      totalCap: 1_500,
      usage: { framingUsed: 0, truncationNotesUsed: 0, evidenceUsed: 0 },
      agents: [
        { id: 'a', ordinal: 0, lastAssistantAt: '2026-09-01T00:00:00.000Z', textLength: 4_000 },
        { id: 'b', ordinal: 1, lastAssistantAt: '2026-09-02T00:00:00.000Z', textLength: 4_000 },
        { id: 'c', ordinal: 2, lastAssistantAt: '2026-09-03T00:00:00.000Z', textLength: 4_000 },
      ],
    });
    const total = allocation.agents.reduce((sum, agent) => sum + agent.budget, 0);
    expect(total).toBeLessThanOrEqual(allocation.agentPool);
  });
});

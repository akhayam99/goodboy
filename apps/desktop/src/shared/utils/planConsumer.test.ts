import { describe, expect, it } from 'vitest';
import type { Agent, AgentId } from '@goodboy/types';
import { planConsumerLabel, resolvePlanConsumer } from './planConsumer';

const agentId = 'agent-9f3c2b1a' as AgentId;

const liveAgent = {
  id: agentId,
  sessionId: 'sess-1',
  ordinal: 0,
  name: 'implementer',
  status: 'done',
} as unknown as Agent;

describe('resolvePlanConsumer', () => {
  it('prefers the live agent name', () => {
    expect(resolvePlanConsumer({ agentId, agentName: 'stale name', agents: [liveAgent] })).toEqual({
      name: 'implementer',
      isDeleted: false,
    });
  });

  it('marks the consumer deleted and keeps the stored name when the agent is gone', () => {
    expect(resolvePlanConsumer({ agentId, agentName: 'implementer', agents: [] })).toEqual({
      name: 'implementer',
      isDeleted: true,
    });
  });

  it('truncates the id when no name survived', () => {
    expect(resolvePlanConsumer({ agentId, agentName: null, agents: [] })).toEqual({
      name: 'agent-9f',
      isDeleted: true,
    });
  });

  it('claims no deletion when the caller has no agent list to check against', () => {
    expect(resolvePlanConsumer({ agentId, agentName: 'implementer' })).toEqual({
      name: 'implementer',
      isDeleted: false,
    });
  });
});

describe('planConsumerLabel', () => {
  it('names the consumer alone for a single run', () => {
    expect(planConsumerLabel({ name: 'implementer', count: 1 })).toBe('Run by implementer');
  });

  it('adds the remainder for several runs', () => {
    expect(planConsumerLabel({ name: 'implementer', count: 3 })).toBe('Run by implementer +2 more');
  });
});

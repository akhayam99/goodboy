import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import { agentLastUpdate } from './agentLastUpdate';

const agent = (stamps: Partial<Agent>): Agent =>
  ({
    id: 'a1' as AgentId,
    sessionId: 's1' as SessionId,
    ordinal: 0,
    name: 'agent 1',
    status: 'pending',
    ...stamps,
  }) as Agent;

describe('agentLastUpdate', () => {
  it('reports nothing for an agent that never ran', () => {
    expect(agentLastUpdate({ agent: agent({}) })).toBeNull();
  });

  it('picks the latest stamp regardless of which field carries it', () => {
    const result = agentLastUpdate({
      agent: agent({
        startedAt: '2026-07-28T10:00:00.000Z' as IsoDateTime,
        lastFinishedAt: '2026-07-28T10:05:00.000Z' as IsoDateTime,
        doneAt: '2026-07-28T10:09:00.000Z' as IsoDateTime,
      }),
    });
    expect(result).toBe('2026-07-28T10:09:00.000Z');
  });

  it('keeps the latest stamp when a later field holds an earlier time', () => {
    const result = agentLastUpdate({
      agent: agent({
        lastFinishedAt: '2026-07-28T10:05:00.000Z' as IsoDateTime,
        doneAt: '2026-07-28T09:00:00.000Z' as IsoDateTime,
      }),
    });
    expect(result).toBe('2026-07-28T10:05:00.000Z');
  });
});

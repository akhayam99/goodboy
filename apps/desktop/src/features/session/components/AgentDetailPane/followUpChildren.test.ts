import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import type { SpawnedChild } from '../../../../shared/utils/spawnedChildren';
import { selectFollowUpChildren } from './followUpChildren';

const sessionId = 'session-1' as SessionId;

const makeSpawned = (over: Partial<Agent>): SpawnedChild => {
  const agent = {
    id: 'agent-2' as AgentId,
    sessionId,
    ordinal: 1,
    name: 'child',
    status: 'running',
    kind: 'planner',
    ...over,
  } as Agent;
  return { agent, index: 0, total: 1, status: agent.status, assignment: null } as SpawnedChild;
};

describe('selectFollowUpChildren', () => {
  it('keeps a child whose kind is one of the offered moves', () => {
    const matched = selectFollowUpChildren({
      spawned: [makeSpawned({})],
      kinds: ['planner', 'implementer'],
    });

    expect(matched).toHaveLength(1);
    expect(matched[0]?.kind).toBe('planner');
  });

  it('drops a child spawned by something other than a follow-up move', () => {
    const matched = selectFollowUpChildren({
      spawned: [makeSpawned({ kind: 'scout', name: 'scout 1' })],
      kinds: ['planner', 'implementer'],
    });

    expect(matched).toHaveLength(0);
  });

  it('reads the kind off the name when the row carries none', () => {
    const matched = selectFollowUpChildren({
      spawned: [makeSpawned({ kind: undefined, name: 'implement the split' })],
      kinds: ['implementer'],
    });

    expect(matched[0]?.kind).toBe('implementer');
  });
});

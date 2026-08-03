import type { Agent, AgentId, IsoDateTime, ProviderRunId, TurnState } from '@goodboy/types';
import { describe, expect, it } from 'vitest';
import { selectSpawnedChildren } from './spawnedChildren';

const agent = (over: {
  id: string;
  ordinal?: number;
  name?: string;
  parentAgentId?: string;
  status?: Agent['status'];
}): Agent =>
  ({
    sessionId: 's1',
    ordinal: over.ordinal ?? 0,
    name: over.name ?? over.id,
    status: over.status ?? 'pending',
    ...over,
    id: over.id as AgentId,
    parentAgentId: over.parentAgentId as AgentId | undefined,
  }) as Agent;

const runs: ReadonlyArray<Agent> = [
  agent({ id: 'child1', name: 'routing', parentAgentId: 'parent', ordinal: 2 }),
  agent({ id: 'parent', ordinal: 0 }),
  agent({ id: 'child0', name: 'auth', parentAgentId: 'parent', ordinal: 1 }),
];

const running: TurnState = {
  kind: 'running',
  runId: 'r1' as ProviderRunId,
  startedAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
};

describe('selectSpawnedChildren', () => {
  it('returns every child ordered by ordinal, whatever their kind', () => {
    const children = selectSpawnedChildren({
      runs,
      parentAgentId: 'parent' as AgentId,
      turnStates: {},
    });
    expect(children.map((child) => child.agent.id)).toEqual(['child0', 'child1']);
    expect(children.map((child) => child.index)).toEqual([0, 1]);
    expect(children.every((child) => child.total === 2)).toBe(true);
  });

  it('returns an empty list for an agent without children', () => {
    expect(
      selectSpawnedChildren({ runs, parentAgentId: 'child0' as AgentId, turnStates: {} }),
    ).toEqual([]);
    expect(selectSpawnedChildren({ runs, parentAgentId: null, turnStates: {} })).toEqual([]);
  });

  it('matches an assignment by child name before falling back to position', () => {
    const children = selectSpawnedChildren({
      runs,
      parentAgentId: 'parent' as AgentId,
      turnStates: {},
      assignments: [
        { name: 'routing', text: 'map the router' },
        { name: 'auth', text: 'map the login' },
      ],
    });
    expect(children[0]?.assignment).toBe('map the login');
    expect(children[1]?.assignment).toBe('map the router');
  });

  it('falls back to the positional assignment and drops empty ones', () => {
    const children = selectSpawnedChildren({
      runs,
      parentAgentId: 'parent' as AgentId,
      turnStates: {},
      assignments: [
        { name: 'unrelated', text: 'first' },
        { name: 'other', text: '  ' },
      ],
    });
    expect(children[0]?.assignment).toBe('first');
    expect(children[1]?.assignment).toBeNull();
  });

  it('promotes a child to running when its turn state is already running', () => {
    const children = selectSpawnedChildren({
      runs,
      parentAgentId: 'parent' as AgentId,
      turnStates: { child1: running },
    });
    expect(children[0]?.status).toBe('pending');
    expect(children[1]?.status).toBe('running');
  });
});

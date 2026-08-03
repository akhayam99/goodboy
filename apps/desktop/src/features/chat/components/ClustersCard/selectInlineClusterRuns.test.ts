import type { Agent, AgentId } from '@goodboy/types';
import { describe, expect, it } from 'vitest';
import { selectInlineClusterRuns } from './selectInlineClusterRuns';

const agent = (over: {
  id: string;
  ordinal?: number;
  parentAgentId?: string;
  kind?: string;
}): Agent =>
  ({
    sessionId: 's1',
    ordinal: 0,
    name: over.id,
    status: 'pending',
    kind: 'implementer',
    ...over,
    id: over.id as AgentId,
    parentAgentId: over.parentAgentId as AgentId | undefined,
  }) as Agent;

const runs: ReadonlyArray<Agent> = [
  agent({ id: 'container', ordinal: 0 }),
  agent({ id: 'child0', parentAgentId: 'container', ordinal: 1 }),
  agent({ id: 'child1', parentAgentId: 'container', ordinal: 2 }),
];

const defs = [
  { title: 'c0', instructions: 'do 0' },
  { title: 'c1', instructions: 'do 1' },
];

describe('selectInlineClusterRuns', () => {
  it('returns defs with null agents when no container is given (pre-spawn)', () => {
    const links = selectInlineClusterRuns(runs, null, defs);
    expect(links).toHaveLength(2);
    expect(links.every((l) => l.agent === null)).toBe(true);
    expect(links[0]?.title).toBe('c0');
  });

  it('joins each def to the container child at the same index', () => {
    const links = selectInlineClusterRuns(runs, 'container' as AgentId, defs);
    expect(links[0]?.agent?.id).toBe('child0');
    expect(links[1]?.agent?.id).toBe('child1');
  });

  it('orders children by ordinal regardless of run array order', () => {
    const shuffled: ReadonlyArray<Agent> = [
      agent({ id: 'child1', parentAgentId: 'container', ordinal: 2 }),
      agent({ id: 'container', ordinal: 0 }),
      agent({ id: 'child0', parentAgentId: 'container', ordinal: 1 }),
    ];
    const links = selectInlineClusterRuns(shuffled, 'container' as AgentId, defs);
    expect(links.map((l) => l.agent?.id)).toEqual(['child0', 'child1']);
  });

  it('leaves a def unmatched (null agent) when no child exists at its index', () => {
    const links = selectInlineClusterRuns(runs, 'container' as AgentId, [
      ...defs,
      { title: 'c2', instructions: 'do 2' },
    ]);
    expect(links[2]?.agent).toBeNull();
  });

  it('ignores non-implementer children when joining', () => {
    const scouts: ReadonlyArray<Agent> = [
      agent({ id: 'container', ordinal: 0 }),
      agent({ id: 's0', parentAgentId: 'container', ordinal: 1, kind: 'scout' }),
    ];
    const links = selectInlineClusterRuns(scouts, 'container' as AgentId, defs);
    expect(links.every((l) => l.agent === null)).toBe(true);
  });
});

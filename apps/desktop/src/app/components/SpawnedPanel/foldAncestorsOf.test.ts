import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import { foldAncestorsOf } from './foldAncestorsOf';
import type { SpawnedRow } from './spawnedRow';

const idOf = (value: string): AgentId => brandId<AgentId>({ value });

const rowOf = (id: string, level: number): SpawnedRow => ({
  id,
  agentId: idOf(id),
  level,
  hasChildren: false,
  title: id,
  card: { title: id, facts: [] },
  role: 'implementer',
  node: 'done',
  word: 'Done',
  isLive: false,
});

const ROWS = [rowOf('root', 1), rowOf('planner', 2), rowOf('scout', 3), rowOf('tester', 2)];

describe('foldAncestorsOf', () => {
  it('lists every ancestor of a nested agent, nearest first', () => {
    expect(foldAncestorsOf({ rows: ROWS, agentId: idOf('scout') })).toEqual(['planner', 'root']);
  });

  it('lists nothing for the root', () => {
    expect(foldAncestorsOf({ rows: ROWS, agentId: idOf('root') })).toEqual([]);
  });

  it('returns null for an agent that is not in the tree', () => {
    expect(foldAncestorsOf({ rows: ROWS, agentId: idOf('missing') })).toBeNull();
  });
});

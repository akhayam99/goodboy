import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import { foldSpawnedRowsOf } from './foldSpawnedRowsOf';
import type { SpawnedRow } from './spawnedRow';

const rowOf = (id: string, level: number): SpawnedRow => ({
  id,
  agentId: brandId<AgentId>({ value: id }),
  level,
  hasChildren: false,
  title: id,
  card: { title: id, facts: [] },
  role: 'implementer',
  node: 'done',
  word: 'Done',
  isLive: false,
});

const ROWS = [
  rowOf('root', 1),
  rowOf('planner', 2),
  rowOf('implementer', 2),
  rowOf('scout', 3),
  rowOf('tester', 2),
];

describe('foldSpawnedRowsOf', () => {
  it('folds a settled tree to its root and keeps the count of its children', () => {
    const shown = foldSpawnedRowsOf({ rows: ROWS, expanded: {}, isOpenByDefault: false });

    expect(shown.map(({ row, count, isExpanded }) => [row.id, count, isExpanded])).toEqual([
      ['root', 3, false],
    ]);
  });

  it('opens a live tree with every parent open', () => {
    const shown = foldSpawnedRowsOf({ rows: ROWS, expanded: {}, isOpenByDefault: true });

    expect(shown.map(({ row }) => row.id)).toEqual([
      'root',
      'planner',
      'implementer',
      'scout',
      'tester',
    ]);
  });

  it('folds one child with children and leaves its siblings shown', () => {
    const shown = foldSpawnedRowsOf({
      rows: ROWS,
      expanded: { implementer: false },
      isOpenByDefault: true,
    });

    expect(shown.map(({ row, count }) => [row.id, count])).toEqual([
      ['root', 3],
      ['planner', 0],
      ['implementer', 1],
      ['tester', 0],
    ]);
  });

  it('opens a settled root the user opened, its folded children still folded', () => {
    const shown = foldSpawnedRowsOf({
      rows: ROWS,
      expanded: { root: true },
      isOpenByDefault: false,
    });

    expect(shown.map(({ row }) => row.id)).toEqual(['root', 'planner', 'implementer', 'tester']);
  });
});

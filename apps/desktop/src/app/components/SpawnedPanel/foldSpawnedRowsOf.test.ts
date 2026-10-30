import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import type { WorkNodeState } from '@goodboy/ui';
import { foldSpawnedRowsOf } from './foldSpawnedRowsOf';
import type { SpawnedRow } from './spawnedRow';

type RowParams = {
  readonly id: string;
  readonly level: number;
  readonly node?: WorkNodeState;
  readonly word?: string;
};

const rowOf = ({ id, level, node = 'done', word = 'Done' }: RowParams): SpawnedRow => ({
  id,
  agentId: brandId<AgentId>({ value: id }),
  level,
  hasChildren: false,
  title: id,
  card: { title: id, facts: [] },
  role: 'implementer',
  node,
  word,
  isLive: node === 'running',
});

const ROWS = [
  rowOf({ id: 'root', level: 1 }),
  rowOf({ id: 'planner', level: 2 }),
  rowOf({ id: 'implementer', level: 2 }),
  rowOf({ id: 'scout', level: 3 }),
  rowOf({ id: 'tester', level: 2 }),
];

const withNode = ({ id, node, word }: Required<Pick<RowParams, 'id' | 'node' | 'word'>>) =>
  ROWS.map((row) => (row.id === id ? { ...row, node, word } : row));

describe('foldSpawnedRowsOf', () => {
  it('never folds a launch root: settled, it keeps one summary line for all its helpers', () => {
    const shown = foldSpawnedRowsOf({ rows: ROWS, expanded: {}, isOpenByDefault: false });

    expect(shown).toHaveLength(1);
    expect(shown[0]).toMatchObject({
      row: { id: 'root' },
      count: 4,
      isExpanded: false,
      isFoldable: false,
      summary: { id: 'root:helpers', level: 2 },
    });
  });

  it('keeps the summary line while a settled root is open, as the way to close it', () => {
    const shown = foldSpawnedRowsOf({
      rows: ROWS,
      expanded: { root: true },
      isOpenByDefault: false,
    });

    expect(shown.map(({ row }) => row.id)).toEqual(['root', 'planner', 'implementer', 'tester']);
    expect(shown[0]).toMatchObject({ isExpanded: true, summary: { id: 'root:helpers' } });
  });

  it('opens a live root with every helper shown and no summary line', () => {
    const shown = foldSpawnedRowsOf({ rows: ROWS, expanded: {}, isOpenByDefault: true });

    expect(shown.map(({ row }) => row.id)).toEqual([
      'root',
      'planner',
      'implementer',
      'scout',
      'tester',
    ]);
    expect(shown.map(({ summary }) => summary)).toEqual([null, null, null, null, null]);
  });

  it('ignores a fold of the live root, which has no control to close it', () => {
    const shown = foldSpawnedRowsOf({
      rows: ROWS,
      expanded: { root: false },
      isOpenByDefault: true,
    });

    expect(shown).toHaveLength(5);
    expect(shown[0]?.isFoldable).toBe(false);
  });

  it('folds only an agent with helpers, and counts them', () => {
    const shown = foldSpawnedRowsOf({
      rows: ROWS,
      expanded: { implementer: false },
      isOpenByDefault: true,
    });

    expect(shown.map(({ row, count, isFoldable }) => [row.id, count, isFoldable])).toEqual([
      ['root', 4, false],
      ['planner', 0, false],
      ['implementer', 1, true],
      ['tester', 0, false],
    ]);
  });

  it('counts every hidden helper of a fold, not only its direct ones', () => {
    const rows = [
      rowOf({ id: 'root', level: 1 }),
      rowOf({ id: 'lead', level: 2 }),
      rowOf({ id: 'scout', level: 3 }),
      rowOf({ id: 'sub', level: 4 }),
    ];

    const shown = foldSpawnedRowsOf({ rows, expanded: { lead: false }, isOpenByDefault: true });

    expect(shown.map(({ row, count }) => [row.id, count])).toEqual([
      ['root', 3],
      ['lead', 2],
    ]);
  });

  it('keeps a settled root opened by the user with its helpers that have helpers still folded', () => {
    const shown = foldSpawnedRowsOf({
      rows: ROWS,
      expanded: { root: true },
      isOpenByDefault: false,
    });

    expect(shown.find(({ row }) => row.id === 'implementer')).toMatchObject({
      isExpanded: false,
      isFoldable: true,
    });
  });

  it('shows the most urgent state of the hidden helpers: needs you, then failed, then running', () => {
    const rows = [
      rowOf({ id: 'root', level: 1 }),
      rowOf({ id: 'lead', level: 2 }),
      rowOf({ id: 'a', level: 3, node: 'running', word: 'Running' }),
      rowOf({ id: 'b', level: 3, node: 'failed', word: 'Failed' }),
    ];

    const failed = foldSpawnedRowsOf({ rows, expanded: { lead: false }, isOpenByDefault: true });
    const asked = foldSpawnedRowsOf({
      rows: [...rows, rowOf({ id: 'c', level: 3, node: 'approval', word: 'Needs permission' })],
      expanded: { lead: false },
      isOpenByDefault: true,
    });

    expect(failed.find(({ row }) => row.id === 'lead')?.urgency).toEqual({
      word: 'Failed',
      tone: 'danger',
      isNeedsYou: false,
    });
    expect(asked.find(({ row }) => row.id === 'lead')?.urgency).toEqual({
      word: 'Needs permission',
      tone: 'warning',
      isNeedsYou: true,
    });
  });

  it('shows no state when every hidden helper is quiet', () => {
    const shown = foldSpawnedRowsOf({ rows: ROWS, expanded: {}, isOpenByDefault: false });

    expect(shown[0]?.urgency).toBeNull();
  });

  it('opens a fold by itself when a hidden helper needs you', () => {
    const rows = withNode({ id: 'scout', node: 'question', word: 'Needs you' });

    const shown = foldSpawnedRowsOf({ rows, expanded: {}, isOpenByDefault: false });

    expect(shown.map(({ row }) => row.id)).toEqual([
      'root',
      'planner',
      'implementer',
      'scout',
      'tester',
    ]);
    expect(shown.find(({ row }) => row.id === 'implementer')).toMatchObject({
      isExpanded: true,
      urgency: { word: 'Needs you', isNeedsYou: true },
    });
  });

  it('does not open a fold for a failed helper, it only says so', () => {
    const rows = withNode({ id: 'scout', node: 'failed', word: 'Failed' });

    const shown = foldSpawnedRowsOf({ rows, expanded: {}, isOpenByDefault: false });

    expect(shown).toHaveLength(1);
    expect(shown[0]?.urgency).toMatchObject({ word: 'Failed', isNeedsYou: false });
  });

  it('lets the user close a fold that opened itself', () => {
    const rows = withNode({ id: 'scout', node: 'question', word: 'Needs you' });

    const shown = foldSpawnedRowsOf({
      rows,
      expanded: { root: true, implementer: false },
      isOpenByDefault: false,
    });

    expect(shown.map(({ row }) => row.id)).toEqual(['root', 'planner', 'implementer', 'tester']);
  });
});

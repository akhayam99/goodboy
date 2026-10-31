import { describe, expect, it } from 'vitest';
import type { WorkNodeState } from '@goodboy/ui';
import { brandId, type AgentId } from '@goodboy/types';
import type { SpawnedRow } from './spawnedRow';
import { spawnedStateGroupsOf } from './spawnedStateGroupsOf';
import { spawnedStateSummaryOf } from './spawnedStateSummaryOf';

type RowParams = {
  readonly key: string;
  readonly node: WorkNodeState;
  readonly level?: number;
};

const rowOf = ({ key, node, level = 2 }: RowParams): SpawnedRow => ({
  id: key,
  agentId: brandId<AgentId>({ value: key }),
  level,
  hasChildren: false,
  title: key,
  card: { title: key, facts: [] },
  role: 'implementer',
  node,
  word: node,
  isLive: node === 'running',
});

const keysOf = (rows: ReadonlyArray<SpawnedRow>): ReadonlyArray<string> =>
  rows.map((row) => row.id);

describe('spawnedStateGroupsOf', () => {
  it('sorts agents into Working, Waiting and Done, newest first inside each group', () => {
    const groups = spawnedStateGroupsOf({
      rows: [
        rowOf({ key: 'root', node: 'running', level: 1 }),
        rowOf({ key: 'plan', node: 'done' }),
        rowOf({ key: 'fix', node: 'running' }),
        rowOf({ key: 'tests', node: 'queued' }),
        rowOf({ key: 'review', node: 'running' }),
        rowOf({ key: 'scout', node: 'done' }),
      ],
    });

    expect(groups.map((group) => [group.label, keysOf(group.rows)])).toEqual([
      ['Working', ['review', 'fix', 'root']],
      ['Waiting', ['tests']],
      ['Done', ['scout', 'plan']],
    ]);
  });

  it.each(['question', 'approval', 'budget', 'alert', 'failed'] as const)(
    'keeps an agent that needs you (%s) out of Done',
    (node) => {
      const groups = spawnedStateGroupsOf({ rows: [rowOf({ key: 'a', node })] });

      expect(groups.map((group) => group.key)).toEqual(['waiting']);
    },
  );

  it.each(['finished', 'closed', 'stopped', 'skipped'] as const)(
    'puts a %s agent in Done',
    (node) => {
      const groups = spawnedStateGroupsOf({ rows: [rowOf({ key: 'a', node })] });

      expect(groups.map((group) => group.key)).toEqual(['done']);
    },
  );

  it('reads an idle Auto root as Done, not Waiting', () => {
    const groups = spawnedStateGroupsOf({
      rows: [
        rowOf({ key: 'root', node: 'queued', level: 1 }),
        rowOf({ key: 'tests', node: 'queued' }),
      ],
    });

    expect(groups.map((group) => [group.key, keysOf(group.rows)])).toEqual([
      ['waiting', ['tests']],
      ['done', ['root']],
    ]);
  });

  it('leaves out a group with no agent and counts every group from the same rows', () => {
    const groups = spawnedStateGroupsOf({
      rows: [rowOf({ key: 'a', node: 'running' }), rowOf({ key: 'b', node: 'done' })],
    });

    expect(groups.map((group) => group.key)).toEqual(['working', 'done']);
    expect(spawnedStateSummaryOf({ groups })).toBe('1 working, 1 done');
  });
});

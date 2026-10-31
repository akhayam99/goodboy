import { describe, expect, it } from 'vitest';
import type { WorkNodeState } from '@goodboy/ui';
import { brandId, type AgentId, type IsoDateTime, type SessionId } from '@goodboy/types';
import type { SpawnedRow } from './spawnedRow';
import { spawnedStateGroupsOf } from './spawnedStateGroupsOf';
import { spawnedStateSummaryOf } from './spawnedStateSummaryOf';

type RowParams = {
  readonly key: string;
  readonly node: WorkNodeState;
  readonly level?: number;
  readonly startedAt?: string;
};

const rowOf = ({ key, node, level = 2, startedAt }: RowParams): SpawnedRow => ({
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
  model:
    startedAt === undefined
      ? null
      : {
          agent: {
            id: brandId<AgentId>({ value: key }),
            sessionId: brandId<SessionId>({ value: 'session' }),
            ordinal: 1,
            name: key,
            status: 'running',
            startedAt: brandId<IsoDateTime>({ value: startedAt }),
          },
          routing: null,
        },
});

type KeysParams = {
  readonly rows: ReadonlyArray<SpawnedRow>;
};

const keysOf = ({ rows }: KeysParams): ReadonlyArray<string> => rows.map((row) => row.id);

describe('spawnedStateGroupsOf', () => {
  it('sorts agents into Working, Waiting and Done, newest first inside each group', () => {
    const groups = spawnedStateGroupsOf({
      rows: [
        rowOf({ key: 'plan', node: 'done' }),
        rowOf({ key: 'fix', node: 'running' }),
        rowOf({ key: 'tests', node: 'queued' }),
        rowOf({ key: 'review', node: 'running' }),
        rowOf({ key: 'scout', node: 'done' }),
      ],
    });

    expect(groups.map((group) => [group.label, keysOf({ rows: group.rows })])).toEqual([
      ['Working', ['review', 'fix']],
      ['Waiting', ['tests']],
      ['Done', ['scout', 'plan']],
    ]);
  });

  it('orders a group by start time, so a nested child started last sits on top', () => {
    const groups = spawnedStateGroupsOf({
      rows: [
        rowOf({ key: 'a', node: 'running', startedAt: '2026-10-20T09:01:00.000Z' }),
        rowOf({ key: 'c', node: 'running', level: 3, startedAt: '2026-10-20T09:03:00.000Z' }),
        rowOf({ key: 'b', node: 'running', startedAt: '2026-10-20T09:02:00.000Z' }),
      ],
    });

    expect(keysOf({ rows: groups[0]?.rows ?? [] })).toEqual(['c', 'b', 'a']);
  });

  it('keeps the traversal order on a tie, and when any agent has no start time', () => {
    const tied = spawnedStateGroupsOf({
      rows: [
        rowOf({ key: 'a', node: 'running', startedAt: '2026-10-20T09:01:00.000Z' }),
        rowOf({ key: 'b', node: 'running', startedAt: '2026-10-20T09:01:00.000Z' }),
      ],
    });
    const partial = spawnedStateGroupsOf({
      rows: [
        rowOf({ key: 'a', node: 'running', startedAt: '2026-10-20T09:09:00.000Z' }),
        rowOf({ key: 'b', node: 'running' }),
      ],
    });

    expect(keysOf({ rows: tied[0]?.rows ?? [] })).toEqual(['b', 'a']);
    expect(keysOf({ rows: partial[0]?.rows ?? [] })).toEqual(['b', 'a']);
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

  it('leaves out a group with no agent and counts every group from the same rows', () => {
    const groups = spawnedStateGroupsOf({
      rows: [rowOf({ key: 'a', node: 'running' }), rowOf({ key: 'b', node: 'done' })],
    });

    expect(groups.map((group) => group.key)).toEqual(['working', 'done']);
    expect(spawnedStateSummaryOf({ groups })).toBe('1 working, 1 done');
  });
});

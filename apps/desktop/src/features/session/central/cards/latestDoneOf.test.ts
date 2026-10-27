// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import type { DoneDay, DoneRowModel } from '../done/doneTypes';
import { latestDoneOf } from './latestDoneOf';

type RowParams = {
  readonly id: string;
  readonly agents: ReadonlyArray<string>;
};

const rowOf = ({ id, agents }: RowParams): DoneRowModel => ({
  id,
  entryId: id,
  title: `Finished ${id}`,
  by: 'Implementer',
  at: '2026-10-18T09:00:00.000Z',
  mountId: null,
  retryAgentId: null,
  agentIds: agents.map((agent) => brandId<AgentId>({ value: agent })),
  detail: {
    model: null,
    effort: null,
    duration: null,
    costUsd: null,
    fullText: null,
    steps: [],
    auto: null,
    branches: [],
    files: null,
  },
});

const DAYS: ReadonlyArray<DoneDay> = [
  {
    key: 'today',
    label: null,
    rows: [
      rowOf({ id: 'a', agents: ['agent-a'] }),
      rowOf({ id: 'b', agents: ['agent-b1', 'agent-b2'] }),
    ],
  },
  {
    key: 'earlier',
    label: 'Yesterday',
    rows: [
      rowOf({ id: 'c', agents: ['agent-c'] }),
      rowOf({ id: 'd', agents: [] }),
      rowOf({ id: 'e', agents: ['agent-e'] }),
    ],
  },
];

describe('latestDoneOf', () => {
  it('keeps the first three rows in order across days', () => {
    const { items } = latestDoneOf({ days: DAYS, unreadAgentIds: new Set() });

    expect(items.map((item) => item.row.id)).toEqual(['a', 'b', 'c']);
  });

  it('marks a row unread when any of its agents is, and counts every unread row, shown or not', () => {
    const { items, unreadCount } = latestDoneOf({
      days: DAYS,
      unreadAgentIds: new Set(['agent-b2', 'agent-e']),
    });

    expect(items.map((item) => item.isUnread)).toEqual([false, true, false]);
    expect(unreadCount).toBe(2);
  });

  it('never reads a row without agents as unread, and says nothing for no rows', () => {
    expect(latestDoneOf({ days: DAYS, unreadAgentIds: new Set(['agent-x']) }).unreadCount).toBe(0);
    expect(latestDoneOf({ days: [], unreadAgentIds: new Set() })).toEqual({
      items: [],
      unreadCount: 0,
    });
  });
});

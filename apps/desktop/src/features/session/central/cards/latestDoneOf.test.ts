// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type Agent,
  type AgentId,
  type IsoDateTime,
  type SessionId,
} from '@goodboy/types';
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
  kind: 'implementer',
  leadAgentId: null,
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

type AgentParams = {
  readonly id: string;
  readonly name?: string;
  readonly lastFinishedAt?: string;
};

const agentOf = ({ id, name = `Agent ${id}`, lastFinishedAt }: AgentParams): Agent => ({
  id: brandId<AgentId>({ value: id }),
  sessionId: brandId<SessionId>({ value: 'session-1' }),
  ordinal: 1,
  name,
  status: 'running',
  ...(lastFinishedAt !== undefined && {
    lastFinishedAt: brandId<IsoDateTime>({ value: lastFinishedAt }),
  }),
});

const unreadOf = (...ids: ReadonlyArray<string>): ReadonlyArray<Agent> =>
  ids.map((id) => agentOf({ id }));

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
    const { items } = latestDoneOf({ days: DAYS, unreadAgents: [] });

    expect(items.map((item) => item.row.id)).toEqual(['a', 'b', 'c']);
  });

  it('marks a row unread when any of its agents is, and lists every unread row newest first, shown or not', () => {
    const { items, unreadItems, unreadCount } = latestDoneOf({
      days: DAYS,
      unreadAgents: unreadOf('agent-b2', 'agent-e'),
    });

    expect(items.map((item) => item.isUnread)).toEqual([false, true, false]);
    expect(unreadItems.map((item) => item.row.id)).toEqual(['b', 'e']);
    expect(unreadCount).toBe(2);
  });

  it('lists an unread agent that has no finished row, so the count and the list agree', () => {
    const unread = latestDoneOf({
      days: DAYS,
      unreadAgents: [
        agentOf({
          id: 'agent-x',
          name: 'Review the ledger',
          lastFinishedAt: '2026-10-18T10:00:00.000Z',
        }),
        agentOf({ id: 'agent-b1', lastFinishedAt: '2026-10-18T08:00:00.000Z' }),
      ],
    });

    expect(unread.unreadCount).toBe(2);
    expect(unread.unreadItems.map((item) => item.row.id)).toEqual(['agent:agent-x', 'b']);
    expect(unread.unreadItems[0]?.row).toMatchObject({
      title: 'Review the ledger',
      by: 'Reviewer',
      kind: 'reviewer',
      leadAgentId: 'agent-x',
      agentIds: ['agent-x'],
      entryId: 'agent:agent-x',
    });
    expect(unread.unreadItems.length).toBe(unread.unreadCount);
  });

  it('lists nothing when no agent is unread', () => {
    expect(latestDoneOf({ days: [], unreadAgents: [] })).toEqual({
      items: [],
      unreadItems: [],
      unreadCount: 0,
    });
  });
});

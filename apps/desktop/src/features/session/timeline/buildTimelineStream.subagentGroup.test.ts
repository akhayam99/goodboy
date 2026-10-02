import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  SessionId,
} from '@goodboy/types';
import { filterTimelineEntries, DEFAULT_ACTIVITY_FILTER } from './activityFilter';
import { buildTimelineGroups } from './buildTimelineGroups';
import {
  buildAgentTreeStream,
  buildTimelineStream,
  type TimelineRowItem,
} from './buildTimelineStream';
import { dayLabel } from './dayLabel';
import { needsYouCount, needsYouRootIds } from './needsYou';
import { layoutTimelineRail } from '../../workTreeModel/railGeometry';

const SESSION_ID = 'session-1' as SessionId;
const NOW = new Date(2026, 7, 18, 12, 0);
const PARENT = 'lead';
const GROUP_ID = 'subagents:agent:lead';
const PARENT_LANE = 'lane:agent:lead';
const GROUP_LANE = `lane:${GROUP_ID}`;

const agentAt = ({
  id,
  ordinal,
  minute,
  status = 'completed',
  parentAgentId,
}: {
  readonly id: string;
  readonly ordinal: number;
  readonly minute: number;
  readonly status?: Agent['status'];
  readonly parentAgentId?: string;
}): Agent => ({
  id: id as AgentId,
  sessionId: SESSION_ID,
  ordinal,
  name: id,
  status,
  ...(parentAgentId === undefined ? {} : { parentAgentId: parentAgentId as AgentId }),
  startedAt: new Date(2026, 7, 18, 9, minute).toISOString() as IsoDateTime,
  ...(status === 'running'
    ? {}
    : { completedAt: new Date(2026, 7, 18, 9, minute, 30).toISOString() as IsoDateTime }),
});

const lead = (): Agent => agentAt({ id: PARENT, ordinal: 1, minute: 0, status: 'running' });

const subagents = ({
  count,
  statuses = [],
}: {
  readonly count: number;
  readonly statuses?: ReadonlyArray<Agent['status']>;
}): ReadonlyArray<Agent> =>
  Array.from({ length: count }, (_, index) =>
    agentAt({
      id: `sub${index}`,
      ordinal: index + 2,
      minute: index + 1,
      status: statuses[index] ?? 'completed',
      parentAgentId: PARENT,
    }),
  );

const question = ({
  id,
  agentId,
}: {
  readonly id: string;
  readonly agentId: string;
}): OpenQuestion => ({
  id: id as OpenQuestionId,
  sessionId: SESSION_ID,
  createdByAgentId: agentId as AgentId,
  text: id,
  suggestedAnswers: [],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: '2026-08-18T09:00:00Z' as IsoDateTime,
});

const streamOf = ({
  agents,
  expanded = [],
  questions = [],
  showAgentSubagents = true,
  showQuestions = false,
}: {
  readonly agents: ReadonlyArray<Agent>;
  readonly expanded?: ReadonlyArray<string>;
  readonly questions?: ReadonlyArray<OpenQuestion>;
  readonly showAgentSubagents?: boolean;
  readonly showQuestions?: boolean;
}) => {
  const entries = buildTimelineGroups({
    sessionId: SESSION_ID,
    agents,
    workflows: [],
    plans: [],
    artifacts: [],
    externalTasks: [],
    questions,
    worktrees: [],
    events: [],
    agentKindOverride: {},
  }).entries;
  return {
    entries,
    ...buildTimelineStream({
      entries,
      unreadAgentIds: new Set(),
      advanceByRunId: new Map(),
      decidingRunIds: new Set(),
      dayLabelFor: ({ at }) => dayLabel({ at, now: NOW }),
      showAgentSubagents,
      showQuestions,
      expandedGroupIds: new Set(expanded),
    }),
  };
};

const rowsOf = (items: ReadonlyArray<{ readonly kind: string }>): ReadonlyArray<TimelineRowItem> =>
  items.filter((item): item is TimelineRowItem => item.kind === 'row');

describe('buildTimelineStream subagent groups', () => {
  it('keeps the group row above its parent when the first subagent starts the same second', () => {
    const parent = agentAt({ id: PARENT, ordinal: 3, minute: 0 });
    const children = [1, 2, 3].map((index) =>
      agentAt({
        id: `sub${index}`,
        ordinal: 3 + index / 10,
        minute: index - 1,
        parentAgentId: PARENT,
      }),
    );
    const { items, groups } = streamOf({ agents: [parent, ...children], expanded: [GROUP_ID] });
    const ids = rowsOf(items).map((row) => row.id);

    expect(ids.slice(-2)).toEqual([GROUP_ID, 'agent:lead']);
    const layout = layoutTimelineRail({ rows: items, groups });
    const header = layout.rows.find((rail) => rail.id === GROUP_ID);
    expect(header?.markerColumn).toBe(layout.columnByGroupId.get(PARENT_LANE));
  });

  it('leaves two subagents as plain rows', () => {
    const { items } = streamOf({ agents: [lead(), ...subagents({ count: 2 })] });

    expect(rowsOf(items).map((row) => row.id)).toEqual(['agent:sub1', 'agent:sub0', 'agent:lead']);
  });

  it('folds three subagents into one closed row above the parent', () => {
    const { items, groups } = streamOf({ agents: [lead(), ...subagents({ count: 3 })] });
    const rows = rowsOf(items);

    expect(rows.map((row) => row.id)).toEqual([GROUP_ID, 'agent:lead']);
    const [group] = rows;
    expect(group?.groupId).toBe(PARENT_LANE);
    expect(group?.entry.kind).toBe('subagentGroup');
    expect(groups.map((entry) => entry.id)).toEqual([PARENT_LANE]);
  });

  it('summarises six subagents by state and sits at the earliest subagent start', () => {
    const { items } = streamOf({
      agents: [
        lead(),
        ...subagents({
          count: 6,
          statuses: ['completed', 'completed', 'running', 'completed', 'completed', 'completed'],
        }),
      ],
    });
    const group = rowsOf(items).find((row) => row.id === GROUP_ID);

    expect(group?.at).toBe(agentAt({ id: 'sub0', ordinal: 2, minute: 1 }).startedAt);
    if (group?.entry.kind !== 'subagentGroup') {
      throw new Error('expected a subagent group');
    }
    expect(group.entry.summary.total).toBe(6);
    expect(group.entry.summary.parts.map((part) => [part.state, part.count])).toEqual([
      ['done', 5],
      ['running', 1],
    ]);
    expect(group.rowState.phase).toBe('running');
  });

  it('grows the children upward above the group row on a lane nested in the parent lane', () => {
    const { items, groups } = streamOf({
      agents: [lead(), ...subagents({ count: 4 })],
      expanded: [GROUP_ID],
    });
    const rows = rowsOf(items);

    expect(rows.map((row) => row.id)).toEqual([
      'agent:sub3',
      'agent:sub2',
      'agent:sub1',
      'agent:sub0',
      GROUP_ID,
      'agent:lead',
    ]);
    expect(rows.slice(0, 4).every((row) => row.groupId === GROUP_LANE)).toBe(true);
    expect(groups).toEqual([
      expect.objectContaining({ id: PARENT_LANE, originRowId: 'agent:lead' }),
      expect.objectContaining({
        id: GROUP_LANE,
        originRowId: GROUP_ID,
        parentGroupId: PARENT_LANE,
        shape: 'merged',
      }),
    ]);
    expect(rows.slice(0, 4).map((row) => row.explode)).toEqual(
      Array.from({ length: 4 }, () => ({ groupId: GROUP_ID, kind: 'subagents' })),
    );

    const layout = layoutTimelineRail({ rows: items, groups });
    const groupRail = layout.rows[items.findIndex((item) => item.id === GROUP_ID)];
    expect(groupRail?.joins.map((join) => join.kind)).toContain('branch');
  });

  it('stays newest first with the group closed and open', () => {
    const between = agentAt({ id: 'other', ordinal: 20, minute: 2 });
    const newer = agentAt({ id: 'newer', ordinal: 21, minute: 30 });
    for (const expanded of [[], [GROUP_ID]]) {
      const { items } = streamOf({
        agents: [lead(), ...subagents({ count: 3 }), between, newer],
        expanded,
      });
      const times = rowsOf(items).flatMap((row) => (row.at === null ? [] : [row.at]));
      const ids = rowsOf(items).map((row) => row.id);

      expect(times).toEqual([...times].sort((first, second) => second.localeCompare(first)));
      expect(ids.indexOf(GROUP_ID)).toBeLessThan(ids.indexOf('agent:lead'));
    }
  });

  it('shows no group and no children when the subagent filter hides them', () => {
    const { items } = streamOf({
      agents: [lead(), ...subagents({ count: 5 })],
      showAgentSubagents: false,
    });

    expect(rowsOf(items).map((row) => row.id)).toEqual(['agent:lead']);
  });

  it('hides the group with its parent when the agents filter hides agents', () => {
    const { entries } = streamOf({ agents: [lead(), ...subagents({ count: 5 })] });
    const filtered = filterTimelineEntries({
      entries,
      filter: { ...DEFAULT_ACTIVITY_FILTER, agents: false },
    });

    expect(filtered).toEqual([]);
  });

  it('keeps the flat tree in the agent tree view', () => {
    const { entries } = streamOf({ agents: [lead(), ...subagents({ count: 6 })] });
    const [entry] = entries;
    if (entry?.kind !== 'agent') {
      throw new Error('expected an agent entry');
    }
    const tree = buildAgentTreeStream({ entry, identity: null, unreadAgentIds: new Set() });

    expect(rowsOf(tree.items)).toHaveLength(7);
    expect(rowsOf(tree.items).some((row) => row.entry.kind === 'subagentGroup')).toBe(false);
  });

  it('does not open the group for a failed child and counts it as needing you', () => {
    const { items } = streamOf({
      agents: [
        lead(),
        ...subagents({ count: 4, statuses: ['completed', 'failed', 'running', 'completed'] }),
      ],
    });
    const rows = rowsOf(items);
    const group = rows.find((row) => row.id === GROUP_ID);

    expect(rows.map((row) => row.id)).toEqual([GROUP_ID, 'agent:lead']);
    if (group?.entry.kind !== 'subagentGroup') {
      throw new Error('expected a subagent group');
    }
    expect(group.entry.summary.failedCount).toBe(1);
    expect(group.entry.summary.parts.at(-1)).toEqual(
      expect.objectContaining({ state: 'failed', count: 1, isFailure: true, tone: 'danger' }),
    );
    expect(group.rowState.phase).toBe('waiting');
    expect(needsYouCount({ items })).toBe(1);
    expect(needsYouRootIds({ items })).toEqual(new Set(['agent:lead']));
  });

  it('does not open the group for a child with an open question', () => {
    const { items } = streamOf({
      agents: [lead(), ...subagents({ count: 3 })],
      questions: [question({ id: 'q1', agentId: 'sub1' })],
    });
    const group = rowsOf(items).find((row) => row.id === GROUP_ID);

    expect(rowsOf(items).map((row) => row.id)).toEqual([GROUP_ID, 'agent:lead']);
    if (group?.entry.kind !== 'subagentGroup') {
      throw new Error('expected a subagent group');
    }
    expect(group.entry.summary.parts.map((part) => part.state)).toEqual(['asking', 'done']);
    expect(group.entry.attentionKeys).toEqual(['q1']);
    expect(needsYouCount({ items })).toBe(1);
  });

  it('does not count a failed child twice once the group is open', () => {
    const agents = [
      lead(),
      ...subagents({ count: 3, statuses: ['failed', 'completed', 'completed'] }),
    ];
    const closed = streamOf({ agents });
    const open = streamOf({ agents, expanded: [GROUP_ID] });

    expect(needsYouCount({ items: closed.items })).toBe(1);
    expect(needsYouCount({ items: open.items })).toBe(1);
  });
});

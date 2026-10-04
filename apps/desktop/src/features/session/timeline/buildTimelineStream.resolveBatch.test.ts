import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import { buildTimelineGroups } from './buildTimelineGroups';
import { buildTimelineStream, type TimelineRowItem } from './buildTimelineStream';
import { needsYouCount, needsYouEntries, needsYouRootIds } from './needsYou';
import type { ResolveActivityFacts } from './resolveActivity';
import { resolveBatchByAgentId, type ResolveBatchRef } from './resolveBatchSummary';
import { layoutTimelineRail } from '../../workTreeModel/railGeometry';
import { dayLabel } from './dayLabel';

const SESSION_ID = 'session-1' as SessionId;
const NOW = new Date(2026, 7, 18, 12, 0);
const BATCH = 'batch-1';
const GROUP_ID = 'batch:batch-1';

const agentAt = ({ id, ordinal }: { readonly id: string; readonly ordinal: number }): Agent => ({
  id: id as AgentId,
  sessionId: SESSION_ID,
  ordinal,
  name: `resolve: tvarga on file${ordinal}.ts:${ordinal}`,
  status: 'completed',
  startedAt: new Date(2026, 7, 18, 9, ordinal).toISOString() as IsoDateTime,
  completedAt: new Date(2026, 7, 18, 9, ordinal, 30).toISOString() as IsoDateTime,
});

const STATES: ReadonlyArray<ResolveActivityFacts['state']> = [
  'ready',
  'drafting',
  'pushed',
  'drafting',
  'ready',
  'failed',
  'drafting',
  'ready',
  'pushed',
  'drafting',
];

const WORDS: Record<string, string> = {
  ready: 'Ready for you',
  drafting: 'Drafting',
  pushed: 'Pushed',
  failed: 'Draft failed',
};

type Setup = {
  readonly agents: ReadonlyArray<Agent>;
  readonly batchByAgentId: ReadonlyMap<string, ResolveBatchRef>;
  readonly factsByAgentId: ReadonlyMap<string, ResolveActivityFacts>;
};

const tenResolvers = ({ batchId = BATCH }: { readonly batchId?: string } = {}): Setup => {
  const agents = STATES.map((_, index) => agentAt({ id: `r${index}`, ordinal: index + 1 }));
  return {
    agents,
    batchByAgentId: new Map(agents.map((agent) => [agent.id, { batchId, prNumber: 318 }] as const)),
    factsByAgentId: new Map(
      agents.map((agent, index) => {
        const state = STATES[index] ?? 'ready';
        return [agent.id, { state, word: WORDS[state] ?? '' }] as const;
      }),
    ),
  };
};

const streamOf = ({
  setup,
  expanded = [],
  full = [],
  extraAgents = [],
}: {
  readonly setup: Setup;
  readonly expanded?: ReadonlyArray<string>;
  readonly full?: ReadonlyArray<string>;
  readonly extraAgents?: ReadonlyArray<Agent>;
}) => {
  const entries = buildTimelineGroups({
    sessionId: SESSION_ID,
    agents: [...setup.agents, ...extraAgents],
    workflows: [],
    plans: [],
    artifacts: [],
    externalTasks: [],
    questions: [],
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
      resolveBatchByAgentId: setup.batchByAgentId,
      resolveFactsByAgentId: setup.factsByAgentId,
      expandedGroupIds: new Set(expanded),
      fullGroupIds: new Set(full),
    }),
  };
};

const rowsOf = (items: ReadonlyArray<{ readonly kind: string }>): ReadonlyArray<TimelineRowItem> =>
  items.filter((item): item is TimelineRowItem => item.kind === 'row');

describe('buildTimelineStream resolve batches', () => {
  it('folds ten resolvers of one batch into a single closed row', () => {
    const { items } = streamOf({ setup: tenResolvers() });
    const rows = rowsOf(items);

    expect(rows).toHaveLength(1);
    const [group] = rows;
    expect(group?.id).toBe(GROUP_ID);
    expect(group?.entry.kind).toBe('resolveBatch');
    if (group?.entry.kind !== 'resolveBatch') {
      return;
    }
    expect(group.entry.summary.total).toBe(10);
    expect(group.entry.summary.parts.map((part) => [part.state, part.count])).toEqual([
      ['ready', 3],
      ['drafting', 4],
      ['pushed', 2],
      ['failed', 1],
    ]);
    expect(group.entry.prNumber).toBe(318);
  });

  it('leaves resolvers without a batch as single rows', () => {
    const setup = tenResolvers();
    const { items } = streamOf({
      setup: { ...setup, batchByAgentId: new Map() },
    });

    expect(rowsOf(items)).toHaveLength(10);
  });

  it('keeps a batch of one resolver as a single row', () => {
    const agents = [agentAt({ id: 'solo', ordinal: 1 })];
    const { items } = streamOf({
      setup: {
        agents,
        batchByAgentId: new Map([['solo', { batchId: 'lonely', prNumber: 318 }]]),
        factsByAgentId: new Map([['solo', { state: 'ready', word: 'Ready for you' }]]),
      },
    });

    expect(rowsOf(items).map((row) => row.id)).toEqual(['agent:solo']);
  });

  it('grows the children upward above the group row on one lane', () => {
    const { items, groups } = streamOf({
      setup: tenResolvers(),
      expanded: [GROUP_ID],
      full: [GROUP_ID],
    });
    const rows = rowsOf(items);
    const groupIndex = rows.findIndex((row) => row.id === GROUP_ID);

    expect(rows).toHaveLength(11);
    expect(groupIndex).toBe(10);
    expect(rows.slice(0, 10).every((row) => row.groupId === `lane:${GROUP_ID}`)).toBe(true);
    expect(rows[groupIndex]?.groupId).toBe(`head:${GROUP_ID}`);
    expect(groups).toEqual([
      expect.objectContaining({
        id: `head:${GROUP_ID}`,
        originRowId: GROUP_ID,
        parentGroupId: null,
        shape: 'head',
      }),
      expect.objectContaining({
        id: `lane:${GROUP_ID}`,
        originRowId: GROUP_ID,
        parentGroupId: `head:${GROUP_ID}`,
        shape: 'merged',
      }),
    ]);

    const layout = layoutTimelineRail({ rows: items, groups });
    const groupRail = layout.rows[items.findIndex((item) => item.id === GROUP_ID)];
    expect(groupRail?.joins.map((join) => join.kind)).toEqual(['stub', 'branch']);
    expect(groupRail?.markerColumn).toBe(1);
    const topChild = layout.rows[items.findIndex((item) => item.id === rows[0]?.id)];
    expect(topChild?.markerColumn).toBe(2);
  });

  it('opens on the eight children nearest the group row, under a Show 2 more row', () => {
    const { items, groups } = streamOf({ setup: tenResolvers(), expanded: [GROUP_ID] });
    const groupIndex = items.findIndex((item) => item.id === GROUP_ID);
    const opened = items.slice(0, groupIndex).filter((item) => item.kind !== 'now');

    expect(opened.map((item) => item.id)).toEqual([
      `more:${GROUP_ID}`,
      ...Array.from({ length: 8 }, (_, index) => `agent:r${7 - index}`),
    ]);
    const more = opened[0];
    expect(more?.kind === 'more' ? more.hiddenCount : null).toBe(2);
    expect(more?.groupId).toBe(`lane:${GROUP_ID}`);
    expect(
      rowsOf(opened).every(
        (row) => row.explode?.groupId === GROUP_ID && row.explode.kind === 'batch',
      ),
    ).toBe(true);
  });

  it('shows every child and no more row once the group is shown in full', () => {
    const { items } = streamOf({ setup: tenResolvers(), expanded: [GROUP_ID], full: [GROUP_ID] });
    const groupIndex = items.findIndex((item) => item.id === GROUP_ID);

    expect(items.some((item) => item.kind === 'more')).toBe(false);
    expect(rowsOf(items.slice(0, groupIndex)).map((row) => row.id)).toEqual(
      Array.from({ length: 10 }, (_, index) => `agent:r${9 - index}`),
    );
  });

  it('stays newest first with the batch closed and open, the group at the batch start', () => {
    const between = agentAt({ id: 'other', ordinal: 5 });
    const newer = agentAt({ id: 'newer', ordinal: 30 });
    const older = agentAt({ id: 'older', ordinal: -3 });
    for (const expanded of [[], [GROUP_ID]]) {
      const { items } = streamOf({
        setup: tenResolvers(),
        extraAgents: [between, newer, older],
        expanded,
      });
      const times = rowsOf(items).flatMap((row) => (row.at === null ? [] : [row.at]));
      const sorted = [...times].sort((first, second) => second.localeCompare(first));
      const group = rowsOf(items).find((row) => row.id === GROUP_ID);
      const ids = rowsOf(items).map((row) => row.id);

      expect(times).toEqual(sorted);
      expect(group?.at).toBe(agentAt({ id: 'r0', ordinal: 1 }).startedAt);
      expect(ids.indexOf('agent:older')).toBeGreaterThan(ids.indexOf(GROUP_ID));
      expect(ids.indexOf('agent:other')).toBeLessThan(ids.indexOf(GROUP_ID));
    }
  });

  it('counts ready and failed children in the need-you count without opening the group', () => {
    const { items, entries } = streamOf({ setup: tenResolvers() });

    expect(needsYouCount({ items })).toBe(4);
    const roots = needsYouRootIds({ items });
    const kept = needsYouEntries({ entries, rootIds: roots }).map((entry) => entry.id);
    expect([...kept].sort()).toEqual(['agent:r0', 'agent:r4', 'agent:r5', 'agent:r7']);
  });

  it('does not count a child twice once the group is open', () => {
    const { items } = streamOf({ setup: tenResolvers(), expanded: [GROUP_ID] });

    expect(needsYouCount({ items })).toBe(4);
  });

  it('does not open the group for a failed child', () => {
    const setup = tenResolvers();
    const { items } = streamOf({ setup });

    expect(rowsOf(items).map((row) => row.id)).toEqual([GROUP_ID]);
    const [group] = rowsOf(items);
    expect(group?.entry.kind === 'resolveBatch' && group.entry.summary.failedCount).toBe(1);
  });

  it('reads the batch of each resolver from the latest attempt', () => {
    const refs = resolveBatchByAgentId({
      attempts: [
        {
          agentId: 'a1',
          batchId: 'old',
          prNumber: 300,
          threadIds: ['t1'],
          phase: 'finished',
          createdAt: 1,
        },
        {
          agentId: 'a1',
          batchId: 'b',
          prNumber: 318,
          threadIds: ['t1'],
          phase: 'running',
          createdAt: 2,
        },
        {
          agentId: 'a3',
          batchId: null,
          prNumber: 318,
          threadIds: ['t3'],
          phase: 'finished',
          createdAt: 3,
        },
      ],
    });

    expect(refs.get('a1')).toEqual({ batchId: 'b', prNumber: 318, origin: 'launch' });
    expect(refs.has('a3')).toBe(false);
  });
});

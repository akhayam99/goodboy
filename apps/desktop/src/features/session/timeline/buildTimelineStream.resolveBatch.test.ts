import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import { buildTimelineGroups } from './buildTimelineGroups';
import { buildTimelineStream, type TimelineRowItem } from './buildTimelineStream';
import { needsYouOwners } from './needsYou';
import type { ResolveActivityFacts } from './resolveActivity';
import { resolveBatchByAgentId, type ResolveBatchRef } from './resolveBatchSummary';
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
        return [
          agent.id,
          {
            state,
            word: WORDS[state] ?? '',
            threads: [{ state, path: `src/file${index}.ts`, line: index + 1 }],
          },
        ] as const;
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
      ['working', 4],
      ['done', 2],
      ['couldnt_fix', 1],
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

  it('opens into one row per file and an Open row, above the group row on one up lane', () => {
    const { items, groups } = streamOf({
      setup: tenResolvers(),
      expanded: [GROUP_ID],
      full: [GROUP_ID],
    });
    const rows = rowsOf(items);

    expect(items.map((item) => item.id).slice(0, 2)).toEqual(['now', `count:${GROUP_ID}`]);
    expect(rows.map((row) => row.id)).toEqual([
      ...Array.from({ length: 10 }, (_, index) => `${GROUP_ID}:file:src/file${index}.ts`),
      `${GROUP_ID}:open`,
      GROUP_ID,
    ]);
    expect(rows.slice(0, -1).every((row) => row.groupId === `lane:${GROUP_ID}`)).toBe(true);
    expect(rows.at(-1)?.groupId).toBeNull();
    expect(groups).toEqual([
      expect.objectContaining({
        id: `lane:${GROUP_ID}`,
        originRowId: GROUP_ID,
        parentGroupId: null,
        direction: 'up',
        shape: 'merged',
      }),
    ]);
  });

  it('folds a settled burst to a count row of its files, with the header keys to open it', () => {
    const { items } = streamOf({ setup: tenResolvers() });
    const count = items.find((item) => item.kind === 'count');
    const header = rowsOf(items).find((row) => row.id === GROUP_ID);

    expect(items.map((item) => item.id)).toEqual(['now', `count:${GROUP_ID}`, GROUP_ID]);
    expect(count?.kind === 'count' ? count.summary.parts[0] : null).toEqual(
      expect.objectContaining({ count: 10, noun: 'files' }),
    );
    expect(header?.branches).toEqual([{ expandId: GROUP_ID, isExpanded: false }]);
  });

  it('keeps a burst with an agent still working open, with no count row', () => {
    const setup = tenResolvers();
    const working = setup.agents.map((agent) =>
      agent.id === 'r3' ? { ...agent, status: 'running' as const } : agent,
    );
    const { items, groups } = streamOf({ setup: { ...setup, agents: working } });

    expect(items.some((item) => item.kind === 'count')).toBe(false);
    expect(rowsOf(items).filter((row) => row.entry.kind === 'resolveFile').length).toBeGreaterThan(
      0,
    );
    expect(groups[0]?.shape).toBe('open');
    expect(rowsOf(items).at(-1)?.branches).toBeUndefined();
  });

  it('reads each file with its lines, its state and the comments it took', () => {
    const setup = tenResolvers();
    const threads = (state: ResolveActivityFacts['state'], lines: ReadonlyArray<number>) =>
      lines.map((line) => ({ state, path: 'src/page.tsx', line }));
    const facts = new Map(setup.factsByAgentId);
    facts.set('r0', { state: 'pushed', word: 'Pushed', threads: threads('pushed', [12, 12, 22]) });
    facts.set('r1', { state: 'failed', word: 'Draft failed', threads: threads('failed', [12]) });
    const { items } = streamOf({
      setup: { ...setup, factsByAgentId: facts },
      expanded: [GROUP_ID],
      full: [GROUP_ID],
    });
    const page = rowsOf(items).find((row) => row.id === `${GROUP_ID}:file:src/page.tsx`);

    expect(page?.entry.kind === 'resolveFile' ? page.entry.lines : null).toEqual([
      { line: 12, count: 3 },
      { line: 22, count: 1 },
    ]);
    expect(page?.entry.kind === 'resolveFile' ? page.entry.state : null).toBe('failed');
    expect(page?.entry.kind === 'resolveFile' ? page.entry.threadCount : null).toBe(4);
  });

  it('opens on the first eight files, under a Show 2 more row above the Open row', () => {
    const { items } = streamOf({ setup: tenResolvers(), expanded: [GROUP_ID] });
    const opened = items.filter((item) => item.kind !== 'now');

    expect(opened.map((item) => item.id)).toEqual([
      `count:${GROUP_ID}`,
      ...Array.from({ length: 8 }, (_, index) => `${GROUP_ID}:file:src/file${index}.ts`),
      `more:${GROUP_ID}`,
      `${GROUP_ID}:open`,
      GROUP_ID,
    ]);
    const more = items.find((item) => item.kind === 'more');
    expect(more?.kind === 'more' ? more.hiddenCount : null).toBe(2);
    expect(more?.groupId).toBe(`lane:${GROUP_ID}`);
    expect(
      rowsOf(opened)
        .slice(0, -1)
        .every((row) => row.explode?.groupId === GROUP_ID && row.explode.kind === 'batch'),
    ).toBe(true);
  });

  it('shows every file and no more row once the group is shown in full', () => {
    const { items } = streamOf({ setup: tenResolvers(), expanded: [GROUP_ID], full: [GROUP_ID] });

    expect(items.some((item) => item.kind === 'more')).toBe(false);
    expect(rowsOf(items).filter((row) => row.entry.kind === 'resolveFile')).toHaveLength(10);
  });

  it('puts threads without a file into one row of their own, last', () => {
    const setup = tenResolvers();
    const facts = new Map(setup.factsByAgentId);
    facts.set('r0', { state: 'ready', word: 'Ready for you' });
    const { items } = streamOf({
      setup: { ...setup, factsByAgentId: facts },
      expanded: [GROUP_ID],
      full: [GROUP_ID],
    });
    const files = rowsOf(items).filter((row) => row.entry.kind === 'resolveFile');

    expect(files.at(-1)?.id).toBe(`${GROUP_ID}:file:no-file`);
    expect(files).toHaveLength(10);
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

  it('gives Needs you one row for the whole group, with the reasons, without opening it', () => {
    const { items, entries } = streamOf({ setup: tenResolvers() });
    const owners = needsYouOwners({ items, entries, events: [] });

    expect(owners.map((owner) => [owner.id, owner.kind, owner.text])).toEqual([
      [GROUP_ID, 'batch', "Resolve #318 · 3 ready · 1 couldn't fix"],
    ]);
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

    expect(refs.get('a1')).toEqual({ batchId: 'b', prNumber: 318 });
    expect(refs.has('a3')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import { keepEqualById } from '../../../shared/utils/keepEqualById';
import { layoutTimelineRail, type RailRow } from '../../workTreeModel/railGeometry';
import { buildTimelineGroups } from './buildTimelineGroups';
import { buildTimelineStream, type TimelineStreamItem } from './buildTimelineStream';
import { dayLabel } from './dayLabel';
import { subagentGroupEntryId } from './subagentGroups';

const SESSION_ID = 'session-perf' as SessionId;
const NOW = new Date(2026, 8, 30, 12, 0);
const BASE = Date.parse('2026-09-30T08:00:00.000Z');
const ROWS = 500;

const at = ({ minutes }: { readonly minutes: number }): IsoDateTime =>
  new Date(BASE + minutes * 60_000).toISOString() as IsoDateTime;

const agentOf = ({
  id,
  ordinal,
  minutes,
  parentAgentId,
}: {
  readonly id: string;
  readonly ordinal: number;
  readonly minutes: number;
  readonly parentAgentId?: string;
}): Agent => ({
  id: id as AgentId,
  sessionId: SESSION_ID,
  ordinal,
  name: `Map ledger-core call site ${ordinal}`,
  status: 'completed',
  startedAt: at({ minutes }),
  completedAt: at({ minutes: minutes + 0.5 }),
  ...(parentAgentId === undefined ? {} : { parentAgentId: parentAgentId as AgentId }),
});

const lead = agentOf({ id: 'lead', ordinal: ROWS + 1, minutes: ROWS + 10 });
const subagents = [1, 2, 3, 4].map((index) =>
  agentOf({
    id: `sub-${index}`,
    ordinal: ROWS + 1 + index,
    minutes: ROWS + 10 + index,
    parentAgentId: 'lead',
  }),
);
const others = Array.from({ length: ROWS }, (_, index) =>
  agentOf({ id: `agent-${index}`, ordinal: index, minutes: index }),
);

const entries = buildTimelineGroups({
  sessionId: SESSION_ID,
  agents: [lead, ...subagents, ...others],
  workflows: [],
  plans: [],
  artifacts: [],
  externalTasks: [],
  questions: [],
  worktrees: [],
  events: [],
  agentKindOverride: {},
}).entries;

const GROUP_ID = subagentGroupEntryId({ parentId: 'agent:lead' });

const streamOf = ({ expanded }: { readonly expanded: ReadonlyArray<string> }) =>
  buildTimelineStream({
    entries,
    unreadAgentIds: new Set(),
    advanceByRunId: new Map(),
    decidingRunIds: new Set(),
    dayLabelFor: ({ at: when }) => dayLabel({ at: when, now: NOW }),
    expandedGroupIds: new Set(expanded),
  });

const byId = <T extends { readonly id: string }>(values: ReadonlyArray<T>) =>
  new Map(values.map((value) => [value.id, value]));

const freshCount = <T extends { readonly id: string }>({
  previous,
  next,
}: {
  readonly previous: ReadonlyArray<T>;
  readonly next: ReadonlyArray<T>;
}): number => {
  const known = new Set(previous);
  return keepEqualById({ previous: byId(previous), next }).filter((value) => !known.has(value))
    .length;
};

describe('buildTimelineStream at five hundred rows', () => {
  it('builds new items only for the rows a group adds or changes when it opens', () => {
    const closed = streamOf({ expanded: [] });
    const open = streamOf({ expanded: [GROUP_ID] });

    expect(closed.items.filter((item) => item.kind === 'row').length).toBeGreaterThan(ROWS);
    expect(open.items.length - closed.items.length).toBe(4);
    expect(
      freshCount<TimelineStreamItem>({ previous: closed.items, next: open.items }),
    ).toBeLessThanOrEqual(6);
  });

  it('keeps every rail row object outside the opened group', () => {
    const closed = streamOf({ expanded: [] });
    const open = streamOf({ expanded: [GROUP_ID] });
    const closedRail = layoutTimelineRail({ rows: closed.items, groups: closed.groups });
    const openRail = layoutTimelineRail({ rows: open.items, groups: open.groups });

    expect(openRail.width).toBe(closedRail.width);
    expect(
      freshCount<RailRow>({ previous: closedRail.rows, next: openRail.rows }),
    ).toBeLessThanOrEqual(6);
  });
});

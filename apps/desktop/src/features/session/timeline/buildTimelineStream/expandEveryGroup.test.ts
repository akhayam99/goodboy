import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import { buildTimelineGroups } from '../buildTimelineGroups';
import { buildTimelineStream, type TimelineStream } from '.';
import { dayLabel } from '../dayLabel';

const SESSION_ID = 'session-open' as SessionId;
const NOW = new Date(2026, 8, 30, 12, 0);
const BASE = Date.parse('2026-09-30T08:00:00.000Z');

type AgentParams = {
  readonly id: string;
  readonly ordinal: number;
  readonly parentAgentId?: string;
};

const agentOf = ({ id, ordinal, parentAgentId }: AgentParams): Agent => ({
  id: id as AgentId,
  sessionId: SESSION_ID,
  ordinal,
  name: `Map ledger-core call site ${ordinal}`,
  status: 'completed',
  startedAt: new Date(BASE + ordinal * 60_000).toISOString() as IsoDateTime,
  completedAt: new Date(BASE + ordinal * 60_000 + 30_000).toISOString() as IsoDateTime,
  ...(parentAgentId === undefined ? {} : { parentAgentId: parentAgentId as AgentId }),
});

const agents = Array.from({ length: 6 }, (_, chain) => {
  const lead = `chain-${chain}`;
  const base = chain * 10;
  return [
    agentOf({ id: lead, ordinal: base }),
    agentOf({ id: `${lead}-1`, ordinal: base + 1, parentAgentId: lead }),
    agentOf({ id: `${lead}-2`, ordinal: base + 2, parentAgentId: `${lead}-1` }),
    agentOf({ id: `${lead}-3`, ordinal: base + 3, parentAgentId: `${lead}-2` }),
  ];
}).flat();

const entries = buildTimelineGroups({
  sessionId: SESSION_ID,
  agents,
  workflows: [],
  plans: [],
  artifacts: [],
  externalTasks: [],
  questions: [],
  worktrees: [],
  events: [],
  agentKindOverride: {},
}).entries;

type BuildParams = {
  readonly expandedGroupIds?: ReadonlySet<string>;
  readonly shouldExpandEveryGroup?: boolean;
};

const build = ({ expandedGroupIds, shouldExpandEveryGroup }: BuildParams): TimelineStream =>
  buildTimelineStream({
    entries,
    unreadAgentIds: new Set(),
    advanceByRunId: new Map(),
    decidingRunIds: new Set(),
    dayLabelFor: ({ at }) => dayLabel({ at, now: NOW }),
    foldsFinished: true,
    ...(expandedGroupIds === undefined ? {} : { expandedGroupIds }),
    ...(shouldExpandEveryGroup === undefined ? {} : { shouldExpandEveryGroup }),
  });

type OpenParams = {
  readonly opened: ReadonlySet<string>;
};

const openByPasses = ({ opened }: OpenParams): TimelineStream => {
  const stream = build({ expandedGroupIds: opened });
  const found = stream.items.flatMap((item) => (item.kind === 'count' ? [item.expandId] : []));
  if (found.every((id) => opened.has(id))) {
    return stream;
  }
  return openByPasses({ opened: new Set([...opened, ...found]) });
};

describe('buildTimelineStream with every group open', () => {
  it('draws in one build the rows that opening each group in turn draws', () => {
    const open = build({ shouldExpandEveryGroup: true });
    const byPasses = openByPasses({ opened: new Set() });

    expect(open.items.map((item) => item.id)).toEqual(byPasses.items.map((item) => item.id));
    expect(open.items.length).toBeGreaterThan(build({}).items.length);
  });
});

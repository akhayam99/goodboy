import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import { buildTimelineGroups } from './buildTimelineGroups';
import { buildTimelineStream, type TimelineRowItem } from './buildTimelineStream';
import { dayLabel } from './dayLabel';
import { needsYouOwners } from './needsYou';
import { resolveFactsByAgentId, type ResolveActivityFacts } from './resolveActivity';
import { rowStateNode, rowStateSentence, rowStateTone } from '../../workTreeModel/rowStateCopy';

const SESSION_ID = 'session-1' as SessionId;
const NOW = new Date(2026, 7, 18, 12, 0);

const agentAt = ({ id, ordinal }: { readonly id: string; readonly ordinal: number }): Agent => ({
  id: id as AgentId,
  sessionId: SESSION_ID,
  ordinal,
  name: `resolve: tvarga on file${ordinal}.ts:${ordinal}`,
  status: 'completed',
  startedAt: new Date(2026, 7, 18, 9, ordinal).toISOString() as IsoDateTime,
  completedAt: new Date(2026, 7, 18, 9, ordinal, 30).toISOString() as IsoDateTime,
});

const rowsFor = ({
  agents,
  facts,
}: {
  readonly agents: ReadonlyArray<Agent>;
  readonly facts: ReadonlyMap<string, ResolveActivityFacts>;
}) => {
  const { items } = buildTimelineStream({
    entries: buildTimelineGroups({
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
    }).entries,
    unreadAgentIds: new Set(),
    advanceByRunId: new Map(),
    decidingRunIds: new Set(),
    dayLabelFor: ({ at }) => dayLabel({ at, now: NOW }),
    resolveFactsByAgentId: facts,
  });
  const rows = items.filter((item): item is TimelineRowItem => item.kind === 'row');
  return { items, byId: new Map(rows.map((row) => [row.id, row])) };
};

const REVIEW_STATES = [
  ['ready', 'Ready for you'],
  ['drafting', 'Drafting'],
  ['pushed', 'Pushed'],
  ['failed', 'Draft failed'],
] as const;

describe('resolver rows read the state of the comment', () => {
  const agents = REVIEW_STATES.map(([state], index) =>
    agentAt({ id: `resolver-${state}`, ordinal: index + 1 }),
  );
  const facts = new Map(
    REVIEW_STATES.map(([state, word]) => [`resolver-${state}`, { state, word }] as const),
  );

  it('says what Review says, never Done for a fix waiting on you', () => {
    const { byId } = rowsFor({ agents, facts });
    const ready = byId.get('agent:resolver-ready');
    const drafting = byId.get('agent:resolver-drafting');
    const pushed = byId.get('agent:resolver-pushed');
    const failed = byId.get('agent:resolver-failed');

    expect(ready && rowStateSentence({ state: ready.rowState })).toBe('Ready for you');
    expect(drafting && rowStateSentence({ state: drafting.rowState })).toBe('Drafting');
    expect(pushed && rowStateSentence({ state: pushed.rowState })).toBe('Pushed');
    expect(failed && rowStateSentence({ state: failed.rowState })).toBe('Draft failed');
  });

  it('takes the tone and the node of Review', () => {
    const { byId } = rowsFor({ agents, facts });
    const tones = REVIEW_STATES.map(([state]) => {
      const row = byId.get(`agent:resolver-${state}`);
      return row && rowStateTone({ state: row.rowState });
    });
    const nodes = REVIEW_STATES.map(([state]) => {
      const row = byId.get(`agent:resolver-${state}`);
      return row && rowStateNode({ state: row.rowState }).state;
    });

    expect(tones).toEqual(['warning', 'info', 'neutral', 'warning']);
    expect(nodes).toEqual(['ready', 'running', 'done', 'alert']);
  });

  it('counts a ready fix and a failed draft as needing you', () => {
    const { items } = rowsFor({ agents, facts });

    expect(
      needsYouOwners({ items, entries: [], events: [] })
        .map((owner) => owner.id)
        .sort(),
    ).toEqual(['agent:resolver-failed', 'agent:resolver-ready']);
  });

  it('keeps the agent state for a resolver Review knows nothing about', () => {
    const { byId } = rowsFor({ agents, facts: new Map() });
    const row = byId.get('agent:resolver-ready');

    expect(row?.rowState.phase).toBe('done');
    expect(row?.rowState.reason).toBeNull();
  });
});

describe('resolveFactsByAgentId', () => {
  const attempt = ({
    agentId,
    threadIds,
    phase,
    createdAt,
  }: {
    readonly agentId: string;
    readonly threadIds: ReadonlyArray<string>;
    readonly phase: 'queued' | 'running' | 'waiting' | 'finished' | 'failed' | 'cancelled';
    readonly createdAt: number;
  }) => ({ agentId, batchId: null, prNumber: 318, threadIds, phase, createdAt });

  it('maps the Review state of the thread and says Ready for a ready fix', () => {
    const facts = resolveFactsByAgentId({
      attempts: [
        attempt({ agentId: 'a1', threadIds: ['t1'], phase: 'finished', createdAt: 1 }),
        attempt({ agentId: 'a3', threadIds: ['t3'], phase: 'finished', createdAt: 3 }),
      ],
      reviews: [
        { threadId: 't1', state: 'ready', word: 'Ready' },
        { threadId: 't3', state: 'pushed', word: 'Pushed' },
      ],
    });

    expect(facts.get('a1')).toMatchObject({ state: 'ready', word: 'Ready' });
    expect(facts.get('a3')).toMatchObject({ state: 'pushed', word: 'Pushed' });
  });

  it('counts the comments of one agent, not the agent, by delivery', () => {
    const facts = resolveFactsByAgentId({
      attempts: [
        attempt({
          agentId: 'a1',
          threadIds: ['t1', 't2', 't3', 't4', 't5', 't6', 't7'],
          phase: 'running',
          createdAt: 1,
        }),
      ],
      reviews: [
        { threadId: 't1', state: 'ready', word: 'To review' },
        { threadId: 't2', state: 'ready', word: 'To review' },
        { threadId: 't3', state: 'edited', word: 'To review' },
        { threadId: 't4', state: 'needs', word: 'Question' },
        { threadId: 't5', state: 'drafting', word: 'Working' },
        { threadId: 't6', state: 'failed', word: 'Push failed', isPushFailure: true },
        { threadId: 't7', state: 'accepted', word: 'Ready' },
      ],
    });

    expect(facts.get('a1')).toMatchObject({
      state: 'ready',
      word: '5 need you · 1 working · 1 ready to push',
    });
    expect(facts.get('a1')?.threads).toHaveLength(7);
  });

  it('falls back to the attempt phase when Review has no row for the thread', () => {
    const facts = resolveFactsByAgentId({
      attempts: [attempt({ agentId: 'a2', threadIds: ['t2'], phase: 'running', createdAt: 2 })],
      reviews: [],
    });

    expect(facts.get('a2')).toEqual({ state: 'drafting', word: 'Working' });
  });

  it('uses the newest attempt of an agent and the comment that needs you first', () => {
    const facts = resolveFactsByAgentId({
      attempts: [
        attempt({ agentId: 'a1', threadIds: ['t1'], phase: 'failed', createdAt: 1 }),
        attempt({ agentId: 'a1', threadIds: ['t1', 't2'], phase: 'finished', createdAt: 5 }),
      ],
      reviews: [
        { threadId: 't1', state: 'pushed', word: 'Pushed' },
        { threadId: 't2', state: 'needs', word: 'Question' },
      ],
    });

    expect(facts.get('a1')).toMatchObject({ state: 'needs', word: '1 need you' });
  });
});

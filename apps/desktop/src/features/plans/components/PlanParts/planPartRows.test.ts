import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  ArtifactId,
  IsoDateTime,
  PlanWithCount,
  SessionId,
} from '@goodboy/types';
import {
  planPartRows,
  planPartsProgress,
  planPartsSentence,
  planSplitSentence,
} from './planPartRows';

const CLUSTERS = [
  {
    title: 'Add a dry run to the backfill job',
    instructions: 'add a flag',
    doneWhen: ['run pnpm test ledger-core', '  '],
    touches: ['ledger-core/src/backfill.ts'],
  },
  {
    title: 'Backfill settled batches behind a flag',
    instructions: 'walk batches',
    routingProposal: {
      pick: { provider: 'anthropic', model: 'claude-sonnet-5', effort: 'medium' },
      reason: 'small change',
      source: 'agent',
      profile: 'implementation',
    },
  },
  { title: 'Skip settled batches in retries', instructions: 'notify-relay' },
] as unknown as PlanWithCount['clusters'];

const plan = (overrides: Partial<PlanWithCount> = {}): PlanWithCount => ({
  id: 'plan-1' as ArtifactId,
  sessionId: 'session-1' as SessionId,
  agentId: 'agent-planner' as AgentId,
  title: 'Backfill the settled batches',
  bodyMd: '',
  status: 'active',
  clusters: CLUSTERS,
  createdAt: '2026-09-14T19:34:00.000Z' as IsoDateTime,
  updatedAt: '2026-09-14T19:34:00.000Z' as IsoDateTime,
  consumptionCount: 0,
  ...overrides,
});

const agent = (overrides: Partial<Agent>): Agent =>
  ({
    id: 'agent-x' as AgentId,
    name: 'Implementer 3',
    kind: 'implementer',
    status: 'pending',
    ordinal: 0,
    ...overrides,
  }) as unknown as Agent;

const RAN = {
  status: 'consumed',
  consumptionCount: 1,
  lastConsumer: { agentId: 'agent-impl' as AgentId, name: 'Implementer 3' },
} as const satisfies Partial<PlanWithCount>;

const CONTAINER = agent({ id: 'agent-impl' as AgentId, status: 'running', ordinal: 4 });

const children = (statuses: ReadonlyArray<Agent['status']>): ReadonlyArray<Agent> =>
  statuses.map((status, index) =>
    agent({
      id: `agent-part-${index}` as AgentId,
      parentAgentId: 'agent-impl' as AgentId,
      status,
      ordinal: 10 - index,
      modelOverride: 'claude-sonnet-5',
      effort: 'high',
    }),
  );

describe('planPartRows', () => {
  it('lists every part as queued with its own checks before the plan runs', () => {
    const rows = planPartRows({ plan: plan(), agents: [], askingAgentIds: new Set() });
    expect(rows.map((row) => [row.title, row.node.state, row.agentId])).toEqual([
      ['Add a dry run to the backfill job', 'queued', null],
      ['Backfill settled batches behind a flag', 'queued', null],
      ['Skip settled batches in retries', 'queued', null],
    ]);
    expect(rows[0]?.doneWhen).toEqual(['run pnpm test ledger-core']);
    expect(rows[0]?.touches).toEqual(['ledger-core/src/backfill.ts']);
  });

  it('shows the model the planner proposed, and nothing when it proposed none', () => {
    const rows = planPartRows({ plan: plan(), agents: [], askingAgentIds: new Set() });
    expect(rows.map((row) => [row.model, row.effort])).toEqual([
      [null, null],
      ['claude-sonnet-5', 'medium'],
      [null, null],
    ]);
  });

  it('gives each part the state of its subagent, matched by ordinal', () => {
    const agents = [CONTAINER, ...children(['pending', 'running', 'completed'])];
    const rows = planPartRows({ plan: plan(RAN), agents, askingAgentIds: new Set() });
    expect(rows.map((row) => [row.node.state, row.agentId])).toEqual([
      ['done', 'agent-part-2'],
      ['running', 'agent-part-1'],
      ['queued', 'agent-part-0'],
    ]);
    expect(rows[0]?.model).toBe('claude-sonnet-5');
  });

  it('marks a part that failed and one that waits on an answer', () => {
    const agents = [CONTAINER, ...children(['pending', 'running', 'failed'])];
    const rows = planPartRows({
      plan: plan(RAN),
      agents,
      askingAgentIds: new Set(['agent-part-1' as AgentId]),
    });
    expect(rows.map((row) => row.node.state)).toEqual(['failed', 'question', 'queued']);
    expect(planPartsSentence({ progress: planPartsProgress({ rows, hasRun: true }) })).toBe(
      'Part 1 failed',
    );
  });

  it('lets a one part plan take the state of its single implementer', () => {
    const single = plan({ ...RAN, clusters: CLUSTERS?.slice(0, 1) });
    const rows = planPartRows({
      plan: single,
      agents: [agent({ id: 'agent-impl' as AgentId, status: 'completed' })],
      askingAgentIds: new Set(),
    });
    expect(rows.map((row) => [row.node.state, row.agentId])).toEqual([['done', 'agent-impl']]);
  });

  it('has no parts for a plan without clusters', () => {
    const { clusters: _dropped, ...bare } = plan();
    expect(planPartRows({ plan: bare, agents: [], askingAgentIds: new Set() })).toEqual([]);
  });
});

describe('planPartsProgress', () => {
  it('reads the running part, then the finished run', () => {
    const running = planPartRows({
      plan: plan(RAN),
      agents: [CONTAINER, ...children(['pending', 'running', 'completed'])],
      askingAgentIds: new Set(),
    });
    expect(
      planPartsSentence({ progress: planPartsProgress({ rows: running, hasRun: true }) }),
    ).toBe('Running part 2 of 3');
    const done = planPartRows({
      plan: plan(RAN),
      agents: [CONTAINER, ...children(['completed', 'completed', 'completed'])],
      askingAgentIds: new Set(),
    });
    expect(planPartsSentence({ progress: planPartsProgress({ rows: done, hasRun: true }) })).toBe(
      'Ran · 3 of 3 parts done',
    );
  });
});

describe('planSplitSentence', () => {
  it('writes who split the plan on the screen', () => {
    expect(planSplitSentence({ count: 3, plannerName: 'Planner 2' })).toBe(
      'Planner 2 split this plan into 3 parts. They run in order, each as its own subagent.',
    );
    expect(planSplitSentence({ count: 1, plannerName: 'Planner 2' })).toBe(
      'Runs as one part, in a single implementer.',
    );
  });
});

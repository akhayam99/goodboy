import { brandId, type AgentId, type MeasuredTurnSpan } from '@goodboy/types';
import { treeSeedOf, type TreeSpec } from '../u27/agentsTreeSeed';

const done = { state: 'settled', outcome: 'completed' } as const;
const running = { state: 'running', outcome: null } as const;
const queued = { state: 'accepted', outcome: null } as const;

const RAIL_TREE: TreeSpec = {
  key: 'rail',
  phase: 'waiting',
  brief: 'Make the payments-api retry safe',
  minute: 90,
  ordinal: 3,
  children: [
    {
      key: 'rail-plan',
      role: 'planner',
      ...done,
      request: { title: 'Plan the retry safe credit flow', task: 'Plan it.' },
      minute: 91,
    },
    {
      key: 'rail-scout',
      role: 'scout',
      ...done,
      request: { title: 'Find every caller of postCredit', task: 'Find them.' },
      minute: 92,
    },
    {
      key: 'rail-key',
      role: 'implementer',
      ...done,
      request: { title: 'Build the idempotency key once per credit', task: 'Build it.' },
      minute: 93,
    },
    {
      key: 'rail-ledger',
      role: 'implementer',
      ...done,
      request: { title: 'Insert ledger-core idempotency keys', task: 'Do it.' },
      minute: 94,
    },
    {
      key: 'rail-webhook',
      role: 'implementer',
      ...done,
      request: { title: 'Dedupe notify-relay deliveries', task: 'Do it.' },
      minute: 95,
    },
    {
      key: 'rail-review-api',
      role: 'reviewer',
      ...done,
      request: { title: 'Review the payments-api diff', task: 'Review.' },
      minute: 97,
    },
    {
      key: 'rail-fix',
      role: 'implementer',
      ...running,
      request: { title: 'Fix the applyCredit retry', task: 'Fix it.' },
      minute: 114,
    },
    {
      key: 'rail-tests',
      role: 'tester',
      ...queued,
      request: { title: 'Run the retry tests with a timeout', task: 'Run them.' },
      minute: 117,
    },
    {
      key: 'rail-review-ledger',
      role: 'reviewer',
      ...running,
      request: { title: 'Review the ledger-core diff', task: 'Review.' },
      minute: 118,
    },
    {
      key: 'rail-relay',
      role: 'scout',
      ...queued,
      request: {
        title: 'Check notify-relay callers',
        task: 'Check them.',
        parent: { delegationId: 'delegation-rail-fix', questionId: 'question-relay', depth: 2 },
      },
      minute: 118.5,
    },
    {
      key: 'rail-summary',
      role: 'docs',
      ...running,
      request: { title: 'Write the retry summary', task: 'Write it.' },
      minute: 119.33,
    },
  ],
};

export const RAIL_SEED = treeSeedOf({ trees: [RAIL_TREE], selectedKey: RAIL_TREE.key });

const ACTIVE_MINUTES: Readonly<Record<string, number>> = {
  'mock-tree-rail': 30,
  'mock-child-rail-plan': 2,
  'mock-child-rail-scout': 1,
  'mock-child-rail-key': 3,
  'mock-child-rail-ledger': 5,
  'mock-child-rail-webhook': 4,
  'mock-child-rail-review-api': 2,
  'mock-child-rail-fix': 6,
  'mock-child-rail-review-ledger': 2,
  'mock-child-rail-summary': 2 / 3,
};

export const RAIL_TURN_SPANS: ReadonlyArray<MeasuredTurnSpan> = RAIL_SEED.agents.flatMap(
  (agent) => {
    const minutes = ACTIVE_MINUTES[agent.id];
    if (minutes === undefined || agent.startedAt == null) {
      return [];
    }
    const startedAtMs = Date.parse(agent.startedAt);
    return [
      {
        agentId: agent.id,
        parentAgentId: agent.parentAgentId ?? null,
        agentStatus: agent.status,
        workflowRunId: null,
        isOrchestratedRunDone: false,
        stepRole: 'implementer',
        provider: 'anthropic',
        model: 'claude-sonnet-5-5',
        effort: 'medium',
        startedAtMs,
        endedAtMs: startedAtMs + minutes * 60_000,
        endReason: 'succeeded',
        costUsd: null,
        touchedMountIds: null,
      } satisfies MeasuredTurnSpan,
    ];
  },
);

export const RAIL_SELECTED_AGENT_ID: AgentId = brandId<AgentId>({ value: 'mock-child-rail-fix' });

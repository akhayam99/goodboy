import { autoBudgetOf, autoTreeSpendOf } from '@goodboy/core';
import type { AutoDelegation, AutoPhase } from '@goodboy/db';
import {
  brandId,
  type Agent,
  type AgentId,
  type AutoTreeId,
  type IsoDateTime,
} from '@goodboy/types';
import { aDelegation, aTree } from '../../../../../features/auto/testing/autoViewFixtures';
import type { AutoTreeView } from '../../../../../store/slices/auto-view/state';
import { sceneClock } from '../../sceneClock';
import { SESSION } from '../activityRunSeed';

const clock = sceneClock({ anchor: '2026-10-20T11:00:00.000Z' });

type AtParams = {
  readonly minute: number;
};

const iso = ({ minute }: AtParams): IsoDateTime =>
  clock.iso({ at: new Date(Date.UTC(2026, 9, 20, 9, 0) + minute * 60_000).toISOString() });
const ms = ({ minute }: AtParams): number =>
  clock.ms({ at: new Date(Date.UTC(2026, 9, 20, 9, 0) + minute * 60_000).toISOString() });

export const TREE_SESSION = { ...SESSION, workflowRuns: [] };

export type ChildSpec = Readonly<{
  key: string;
  role: string;
  state: AutoDelegation['state'];
  outcome: AutoDelegation['outcome'];
  request: Readonly<Record<string, unknown>>;
  minute: number;
}>;

export type TreeSpec = Readonly<{
  key: string;
  phase: AutoPhase;
  brief: string;
  minute: number;
  ordinal: number;
  children: ReadonlyArray<ChildSpec>;
}>;

const done = { state: 'settled', outcome: 'completed' } as const;
const running = { state: 'running', outcome: null } as const;
const queued = { state: 'accepted', outcome: null } as const;

const LIVE: TreeSpec = {
  key: 'live',
  phase: 'waiting',
  brief: 'Make the payments-api retry safe end to end, with tests and docs.',
  minute: 90,
  ordinal: 3,
  children: [
    {
      key: 'live-plan',
      role: 'planner',
      ...done,
      request: { title: 'Plan the retry safe credit flow', task: 'Plan it.' },
      minute: 91,
    },
    {
      key: 'live-scout',
      role: 'scout',
      ...done,
      request: { task: 'Find every caller of postCredit in payments-api. List them.' },
      minute: 92,
    },
    {
      key: 'live-key',
      role: 'implementer',
      ...done,
      request: { title: 'Build the idempotency key once', task: 'Build it.' },
      minute: 93,
    },
    {
      key: 'live-ledger',
      role: 'implementer',
      ...done,
      request: { title: 'Insert ledger-core credits under a unique key', task: 'Do it.' },
      minute: 94,
    },
    {
      key: 'live-webhook',
      role: 'implementer',
      ...done,
      request: { title: 'Dedupe notify-relay webhooks by event id', task: 'Do it.' },
      minute: 95,
    },
    {
      key: 'live-old',
      role: 'implementer',
      ...done,
      request: {},
      minute: 96,
    },
    {
      key: 'live-review-api',
      role: 'reviewer',
      ...done,
      request: { title: 'Review the payments-api side', task: 'Review.' },
      minute: 97,
    },
    {
      key: 'live-review-ledger',
      role: 'reviewer',
      ...running,
      request: { title: 'Review the ledger-core side', task: 'Review.' },
      minute: 98,
    },
    {
      key: 'live-race',
      role: 'implementer',
      ...running,
      request: { title: 'Fix the applyCredit race', task: 'Fix it.' },
      minute: 99,
    },
    {
      key: 'live-tests',
      role: 'tester',
      ...queued,
      request: { title: 'Run the retry tests in payments-api', task: 'Run them.' },
      minute: 101,
    },
    {
      key: 'live-docs',
      role: 'docs',
      ...queued,
      request: {
        task: '## Goal\nWrite the retry section of the payments-api guide. Keep it short.',
      },
      minute: 100,
    },
    {
      key: 'live-relay',
      role: 'scout',
      ...queued,
      request: { title: 'Check notify-relay for duplicate retries', task: 'Check it.' },
      minute: 102,
    },
  ],
};

const SETTLED_ONE: TreeSpec = {
  key: 'cache',
  phase: 'done',
  brief: 'Why does the Harborline cache miss on every deploy?',
  minute: 40,
  ordinal: 2,
  children: [
    {
      key: 'cache-scout',
      role: 'scout',
      ...done,
      request: { title: 'Find where the cache key is built', task: 'Find it.' },
      minute: 41,
    },
    {
      key: 'cache-fix',
      role: 'implementer',
      ...done,
      request: { title: 'Keep the cache key across deploys', task: 'Fix it.' },
      minute: 45,
    },
    {
      key: 'cache-review',
      role: 'reviewer',
      ...done,
      request: { title: 'Review the cache key change', task: 'Review.' },
      minute: 50,
    },
  ],
};

const SETTLED_TWO: TreeSpec = {
  key: 'notes',
  phase: 'done',
  brief: 'Write the Northwind release notes for 2.4.',
  minute: 10,
  ordinal: 1,
  children: [
    {
      key: 'notes-scout',
      role: 'scout',
      ...done,
      request: { title: 'List the merged changes since 2.3', task: 'List.' },
      minute: 11,
    },
    {
      key: 'notes-write',
      role: 'docs',
      ...done,
      request: { title: 'Write the 2.4 release notes', task: 'Write.' },
      minute: 15,
    },
  ],
};

const TREES: ReadonlyArray<TreeSpec> = [LIVE, SETTLED_ONE, SETTLED_TWO];

type KeyParams = {
  readonly key: string;
};

const rootIdOf = ({ key }: KeyParams): AgentId => brandId<AgentId>({ value: `mock-tree-${key}` });
const childIdOf = ({ key }: KeyParams): AgentId => brandId<AgentId>({ value: `mock-child-${key}` });

type TreeParams = {
  readonly tree: TreeSpec;
};

const viewOf = ({ tree }: TreeParams): AutoTreeView => {
  const treeId = brandId<AutoTreeId>({ value: `mock-tree-${tree.key}` });
  return {
    tree: {
      ...aTree({ phase: tree.phase }),
      id: treeId,
      rootAgentId: rootIdOf({ key: tree.key }),
      sessionId: TREE_SESSION.id,
    },
    delegations: tree.children.map((child) => ({
      ...aDelegation({
        key: child.key,
        role: child.role,
        state: child.state,
        outcome: child.outcome,
        settledAt: child.state === 'settled' ? ms({ minute: child.minute + 5 }) : null,
      }),
      treeId,
      childAgentId: childIdOf({ key: child.key }),
      request: child.request,
      createdAt: ms({ minute: child.minute }),
      deadlineAt: ms({ minute: child.minute + 600 }),
    })),
    artifacts: [],
    budget: autoBudgetOf({
      spend: autoTreeSpendOf({
        capUsd: 10,
        settledUsd: 1.2,
        liveUsd: 0,
        reservedUsd: 0,
        estimatedUsd: 0,
      }),
    }),
    pendingRefusal: null,
    pendingMessages: [],
    deliveredResults: [],
    hiddenChildIds: [],
    rootAsk: tree.brief,
  };
};

const STATUS_BY_STATE: Readonly<Record<string, Agent['status']>> = {
  settled: 'completed',
  running: 'running',
};

const agentStatusOf = ({ state }: Pick<ChildSpec, 'state'>): Agent['status'] =>
  STATUS_BY_STATE[state] ?? 'pending';

const rootOf = ({ tree }: TreeParams): Agent => ({
  id: rootIdOf({ key: tree.key }),
  sessionId: TREE_SESSION.id,
  ordinal: tree.ordinal,
  name: 'Auto',
  status: tree.phase === 'done' ? 'completed' : 'running',
  kind: 'auto',
  startedAt: iso({ minute: tree.minute }),
  lastViewedAt: iso({ minute: 120 }),
});

const childrenOf = ({ tree }: TreeParams): ReadonlyArray<Agent> =>
  tree.children.map((child, index): Agent => ({
    id: childIdOf({ key: child.key }),
    sessionId: TREE_SESSION.id,
    ordinal: tree.ordinal * 100 + index,
    name: child.role,
    status: agentStatusOf({ state: child.state }),
    startedAt: iso({ minute: child.minute }),
    parentAgentId: rootIdOf({ key: tree.key }),
    lastViewedAt: iso({ minute: 120 }),
  }));

export type TreeSeed = Readonly<{
  views: ReadonlyArray<AutoTreeView>;
  agents: ReadonlyArray<Agent>;
  rootIds: ReadonlyArray<AgentId>;
  selectedRootId: AgentId;
}>;

type SeedParams = {
  readonly trees: ReadonlyArray<TreeSpec>;
  readonly selectedKey: string;
};

export const treeSeedOf = ({ trees, selectedKey }: SeedParams): TreeSeed => ({
  views: trees.map((tree) => viewOf({ tree })),
  agents: trees.flatMap((tree) => [rootOf({ tree }), ...childrenOf({ tree })]),
  rootIds: trees.map((tree) => rootIdOf({ key: tree.key })),
  selectedRootId: rootIdOf({ key: selectedKey }),
});

export const TREE_SEED = treeSeedOf({ trees: TREES, selectedKey: LIVE.key });

export const TREE_VIEWS = TREE_SEED.views;

export const TREE_AGENTS = TREE_SEED.agents;

export const TREE_ROOT_IDS = TREE_SEED.rootIds;

export const TREE_LIVE_ROOT_ID: AgentId = TREE_SEED.selectedRootId;

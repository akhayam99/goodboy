import { autoBudgetOf, autoTreeSpendOf } from '@goodboy/core';
import type { AutoDelegation, AutoOutcome, AutoPhase } from '@goodboy/db';
import {
  brandId,
  type Agent,
  type AgentId,
  type AutoBatchId,
  type AutoDelegationId,
  type IsoDateTime,
  type MeasuredTurnSpan,
  type ProviderRunId,
  type SessionId,
} from '@goodboy/types';
import { aTree } from '../../../../../features/auto/testing/autoViewFixtures';
import type { WorkTimeSource } from '../../../../../features/workTreeModel/workTimeSource';
import type {
  AutoDeliveredResult,
  AutoTreeView,
} from '../../../../../store/slices/auto-view/state';
import { sceneClock } from '../../sceneClock';

const ANCHOR = '2026-10-18T10:24:00.000Z';
const clock = sceneClock({ anchor: ANCHOR });

type AtParams = {
  readonly time: string;
};

const at = ({ time }: AtParams): IsoDateTime => clock.iso({ at: `2026-10-18T${time}.000Z` });
const ms = ({ time }: AtParams): number => clock.ms({ at: `2026-10-18T${time}.000Z` });

export const CENTRAL_AUTO_SESSION = brandId<SessionId>({ value: 'mock-central-auto-session' });
export const CENTRAL_AUTO_NOW = clock.ms({ at: ANCHOR });

const ROOT_ID = brandId<AgentId>({ value: 'mock-central-auto-root' });
const REVIEWER_ID = brandId<AgentId>({ value: 'mock-central-auto-reviewer' });
const FIXER_ID = brandId<AgentId>({ value: 'mock-central-auto-fixer' });
const BATCH = brandId<AutoBatchId>({ value: 'mock-central-auto-batch' });
const RUN = brandId<ProviderRunId>({ value: 'mock-central-auto-run' });

export type CentralAutoVariant = 'working' | 'stuck' | 'failed' | 'done';

export type CentralAutoSeed = Readonly<{
  view: AutoTreeView;
  agents: ReadonlyArray<Agent>;
  source: WorkTimeSource;
  isCompact: boolean;
}>;

type DelegationParams = {
  readonly key: string;
  readonly childId: AgentId;
  readonly role: string;
  readonly task: string;
  readonly slot: number;
  readonly createdAt: string;
  readonly state: AutoDelegation['state'];
  readonly outcome: AutoOutcome | null;
  readonly settledAt: string | null;
  readonly reason: string | null;
};

const delegationOf = ({
  key,
  childId,
  role,
  task,
  slot,
  createdAt,
  state,
  outcome,
  settledAt,
  reason,
}: DelegationParams): AutoDelegation => ({
  id: brandId<AutoDelegationId>({ value: `mock-central-auto-delegation-${key}` }),
  treeId: aTree().id,
  generation: 1,
  requestId: brandId({ value: 'mock-central-auto-request' }),
  requestHash: 'mock-central-auto-request',
  batchId: BATCH,
  slot,
  childAgentId: childId,
  firstAttemptId: brandId({ value: `mock-central-auto-attempt-${key}` }),
  role,
  request: { task, reason: 'Keeps the retry fix honest before you push.' },
  target: { mountName: 'payments-api' },
  routing: { provider: 'anthropic', model: 'sonnet', effort: 'medium', reason: 'chosen' },
  state,
  outcome,
  reason,
  retryOf: null,
  reviseOf: null,
  baseRevision: null,
  isAdopted: false,
  isStopping: false,
  questionCycles: 0,
  deadlineAt: ms({ time: '10:50:00' }),
  result: null,
  createdAt: ms({ time: createdAt }),
  settledAt: settledAt === null ? null : ms({ time: settledAt }),
});

const REVIEWER = delegationOf({
  key: 'reviewer',
  childId: REVIEWER_ID,
  role: 'reviewer',
  task: 'Review the retry fix in payments-api.',
  slot: 0,
  createdAt: '10:12:00',
  state: 'settled',
  outcome: 'completed',
  settledAt: '10:18:00',
  reason: null,
});

type FixerParams = Partial<DelegationParams>;

const fixerOf = (overrides: FixerParams): AutoDelegation =>
  delegationOf({
    key: 'fixer',
    childId: FIXER_ID,
    role: 'implementer',
    task: 'Fix the two doc mismatches in ledger-core.',
    slot: 1,
    createdAt: '10:19:00',
    state: 'running',
    outcome: null,
    settledAt: null,
    reason: null,
    ...overrides,
  });

const FIXER_BY_VARIANT: Readonly<Record<CentralAutoVariant, AutoDelegation>> = {
  working: fixerOf({}),
  stuck: fixerOf({ createdAt: '10:21:10', state: 'accepted' }),
  failed: fixerOf({
    state: 'settled',
    outcome: 'timed_out',
    settledAt: '10:23:40',
    reason: 'It ran past its 30 minute deadline before sending a result.',
  }),
  done: fixerOf({ state: 'settled', outcome: 'completed', settledAt: '10:23:00' }),
};

const DELIVERED: ReadonlyArray<AutoDeliveredResult> = [
  {
    runId: RUN,
    delegationId: `mock-central-auto-delegation-reviewer`,
    childAgentId: REVIEWER_ID,
    role: 'reviewer',
    provider: 'anthropic',
    model: 'sonnet',
    outcome: 'completed',
    summary: 'Found 2 doc mismatches',
  },
];

const DONE_DELIVERED: ReadonlyArray<AutoDeliveredResult> = [
  ...DELIVERED,
  {
    runId: RUN,
    delegationId: 'mock-central-auto-delegation-fixer',
    childAgentId: FIXER_ID,
    role: 'implementer',
    provider: 'anthropic',
    model: 'sonnet',
    outcome: 'completed',
    summary: 'Fixed both mismatches in ledger-core',
  },
];

const PHASE_BY_VARIANT: Readonly<Record<CentralAutoVariant, AutoPhase>> = {
  working: 'waiting',
  stuck: 'waiting',
  failed: 'waiting',
  done: 'done',
};

type AgentParams = {
  readonly id: AgentId;
  readonly name: string;
  readonly kind: 'auto' | 'reviewer' | 'implementer';
  readonly status: Agent['status'];
  readonly startedAt: string | null;
  readonly completedAt: string | null;
};

const agentOf = ({ id, name, kind, status, startedAt, completedAt }: AgentParams): Agent => ({
  id,
  sessionId: CENTRAL_AUTO_SESSION,
  ordinal: 0,
  name,
  status,
  kind,
  ...(startedAt === null ? {} : { startedAt: at({ time: startedAt }) }),
  ...(completedAt === null ? {} : { completedAt: at({ time: completedAt }) }),
  ...(id !== ROOT_ID && { parentAgentId: ROOT_ID }),
});

const ROOT_AGENT = agentOf({
  id: ROOT_ID,
  name: 'Harden retries in payments-api',
  kind: 'auto',
  status: 'running',
  startedAt: '10:10:00',
  completedAt: null,
});

const REVIEWER_AGENT = agentOf({
  id: REVIEWER_ID,
  name: 'Reviewer',
  kind: 'reviewer',
  status: 'completed',
  startedAt: '10:12:05',
  completedAt: '10:18:00',
});

type SpanParams = {
  readonly agentId: AgentId;
  readonly startedAt: string;
  readonly endedAt: string;
};

const spanOf = ({ agentId, startedAt, endedAt }: SpanParams): MeasuredTurnSpan => ({
  agentId,
  parentAgentId: ROOT_ID,
  agentStatus: 'completed',
  workflowRunId: null,
  isOrchestratedRunDone: false,
  stepRole: 'reviewer',
  provider: 'anthropic',
  model: 'sonnet',
  effort: 'medium',
  startedAtMs: ms({ time: startedAt }),
  endedAtMs: ms({ time: endedAt }),
  endReason: 'succeeded',
  costUsd: null,
  touchedMountIds: null,
});

const REVIEWER_SPAN = spanOf({
  agentId: REVIEWER_ID,
  startedAt: '10:12:05',
  endedAt: '10:18:00',
});

type SeedParams = {
  readonly variant: CentralAutoVariant;
};

const fixerAgentOf = ({ variant }: SeedParams): Agent => {
  switch (variant) {
    case 'working':
      return agentOf({
        id: FIXER_ID,
        name: 'Implementer',
        kind: 'implementer',
        status: 'running',
        startedAt: '10:19:05',
        completedAt: null,
      });
    case 'stuck':
      return agentOf({
        id: FIXER_ID,
        name: 'Implementer',
        kind: 'implementer',
        status: 'pending',
        startedAt: null,
        completedAt: null,
      });
    case 'failed':
      return agentOf({
        id: FIXER_ID,
        name: 'Implementer',
        kind: 'implementer',
        status: 'failed',
        startedAt: '10:19:05',
        completedAt: '10:23:40',
      });
    case 'done':
      return agentOf({
        id: FIXER_ID,
        name: 'Implementer',
        kind: 'implementer',
        status: 'completed',
        startedAt: '10:19:05',
        completedAt: '10:23:00',
      });
    default: {
      const exhaustive: never = variant;
      return exhaustive;
    }
  }
};

const sourceOf = ({ variant }: SeedParams): WorkTimeSource => {
  const fixerSpan = spanOf({
    agentId: FIXER_ID,
    startedAt: '10:19:05',
    endedAt: variant === 'failed' ? '10:23:40' : '10:23:00',
  });
  const spans =
    variant === 'working' || variant === 'stuck' ? [REVIEWER_SPAN] : [REVIEWER_SPAN, fixerSpan];
  return {
    nowMs: CENTRAL_AUTO_NOW,
    spans,
    history: null,
    liveStartMs:
      variant === 'working' ? new Map([[FIXER_ID, ms({ time: '10:19:05' })]]) : new Map(),
    childrenOf: new Map(),
  };
};

export const centralAutoSeedOf = ({ variant }: SeedParams): CentralAutoSeed => ({
  view: {
    tree: {
      ...aTree({ phase: PHASE_BY_VARIANT[variant], capUsd: 10 }),
      rootAgentId: ROOT_ID,
      sessionId: CENTRAL_AUTO_SESSION,
    },
    delegations: [REVIEWER, FIXER_BY_VARIANT[variant]],
    artifacts: [],
    budget: autoBudgetOf({
      spend: autoTreeSpendOf({ capUsd: 10, settledUsd: 0.41, reservedUsd: 0, estimatedUsd: 0 }),
    }),
    pendingRefusal: null,
    deliveredResults: variant === 'done' ? DONE_DELIVERED : DELIVERED,
  },
  agents: [ROOT_AGENT, REVIEWER_AGENT, fixerAgentOf({ variant })],
  source: sourceOf({ variant }),
  isCompact: variant === 'done',
});

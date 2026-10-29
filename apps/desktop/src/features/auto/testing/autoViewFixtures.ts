import { autoBudgetOf, autoTreeSpendOf } from '@goodboy/core';
import type { AutoArtifactLedgerRow, AutoDelegation, AutoPhase, AutoTree } from '@goodboy/db';
import {
  brandId,
  type AgentId,
  type ArtifactId,
  type AutoBatchId,
  type AutoDelegationId,
  type AutoTreeId,
  type SessionId,
} from '@goodboy/types';
import type {
  AutoDeliveredResult,
  AutoPendingMessage,
  AutoPendingRefusal,
  AutoTreeView,
} from '../../../store/slices/auto-view/state';

export const FIXTURE_NOW = Date.UTC(2026, 9, 13, 12, 4, 0);
export const FIXTURE_SESSION = brandId<SessionId>({ value: 'session-harborline' });
export const FIXTURE_TREE = brandId<AutoTreeId>({ value: 'tree-harborline' });
export const FIXTURE_ROOT = brandId<AgentId>({ value: 'agent-auto' });

type TreeParams = {
  readonly phase?: AutoPhase;
  readonly capUsd?: number;
};

export const aTree = ({ phase = 'answering', capUsd = 10 }: TreeParams = {}): AutoTree => ({
  id: FIXTURE_TREE,
  rootAgentId: FIXTURE_ROOT,
  sessionId: FIXTURE_SESSION,
  primaryMountId: 'mount-payments-api',
  generation: 1,
  phase,
  phaseRev: 0,
  blockedReason: null,
  activeRunId: null,
  activeDeliveryId: null,
  isYieldRequested: false,
  stopState: 'none',
  capUsd,
  turnsUsed: 0,
  delegationsUsed: 0,
  attemptsUsed: 0,
  refusalsUsed: 0,
  turnDelegateCalls: 0,
  noProgressStreak: 0,
  questionCycles: 0,
  grants: 0,
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
  hardDeadlineAt: FIXTURE_NOW + 86_400_000,
  schedulerOwner: null,
  ownerLeaseExpiresAt: null,
});

type DelegationParams = {
  readonly key: string;
  readonly role: string;
  readonly state: AutoDelegation['state'];
  readonly outcome?: AutoDelegation['outcome'];
  readonly batch?: string;
  readonly reason?: string;
  readonly model?: string;
  readonly effort?: string;
  readonly settledAt?: number | null;
  readonly result?: unknown;
  readonly reviseOf?: string | null;
  readonly baseRevision?: number | null;
  readonly routing?: Readonly<Record<string, unknown>>;
  readonly alternatives?: ReadonlyArray<Readonly<{ label: string; role: string }>>;
};

export const aDelegation = ({
  key,
  role,
  state,
  outcome = null,
  batch = 'batch-1',
  reason = 'Touches idempotency in payments-api and ledger-core, so it needs a plan.',
  model = 'opus',
  effort = 'high',
  settledAt = null,
  result = null,
  reviseOf = null,
  baseRevision = null,
  routing = {},
  alternatives = [],
}: DelegationParams): AutoDelegation => ({
  id: brandId<AutoDelegationId>({ value: `delegation-${key}` }),
  treeId: FIXTURE_TREE,
  generation: 1,
  requestId: brandId({ value: `request-${batch}` }),
  requestHash: `hash-${batch}`,
  batchId: brandId<AutoBatchId>({ value: batch }),
  slot: 0,
  childAgentId: brandId<AgentId>({ value: `agent-${key}` }),
  firstAttemptId: brandId({ value: `attempt-${key}` }),
  role,
  request: {
    task: `work for ${key}`,
    reason,
    ...(alternatives.length === 0 ? {} : { alternatives }),
  },
  target: { mountName: 'payments-api' },
  routing: { provider: 'anthropic', model, effort, reason: 'chosen for the role', ...routing },
  state,
  outcome,
  reason: null,
  retryOf: null,
  reviseOf,
  baseRevision,
  isAdopted: false,
  isStopping: false,
  questionCycles: 0,
  deadlineAt: FIXTURE_NOW + 1_800_000,
  result,
  createdAt: FIXTURE_NOW,
  settledAt,
});

type PlanParams = {
  readonly approvalState?: 'needs_approval' | 'approved' | 'revising';
  readonly revision?: number;
  readonly approvedRevision?: number | null;
  readonly openRevise?: string | null;
  readonly title?: string;
};

export const aPlanRow = ({
  approvalState = 'needs_approval',
  revision = 1,
  approvedRevision = null,
  openRevise = null,
  title = 'Retry-safe credit retries',
}: PlanParams = {}): AutoArtifactLedgerRow => ({
  artifact: {
    artifactId: brandId<ArtifactId>({ value: 'artifact-plan' }),
    treeId: FIXTURE_TREE,
    kind: 'plan',
    ownerAgentId: brandId<AgentId>({ value: 'agent-planner' }),
    ownerDelegationId: brandId<AutoDelegationId>({ value: 'delegation-planner' }),
    ownerRole: 'planner',
    approvalState,
    approvedRevision,
    openReviseDelegationId:
      openRevise === null ? null : brandId<AutoDelegationId>({ value: openRevise }),
    rev: 0,
    createdAt: FIXTURE_NOW,
  },
  title,
  revision,
  status: 'active',
  sourceText: '',
  updatedAt: FIXTURE_NOW,
  lastAuthor: null,
  lastAsk: null,
});

type ArtifactRowParams = {
  readonly id: string;
  readonly kind: AutoArtifactLedgerRow['artifact']['kind'];
  readonly title: string;
  readonly revision?: number;
  readonly sourceText?: string;
};

export const anArtifactRow = ({
  id,
  kind,
  title,
  revision = 1,
  sourceText = '',
}: ArtifactRowParams): AutoArtifactLedgerRow => {
  const base = aPlanRow({ title, revision });
  return {
    ...base,
    artifact: { ...base.artifact, artifactId: brandId<ArtifactId>({ value: id }), kind },
    sourceText,
  };
};

type ViewParams = {
  readonly phase?: AutoPhase;
  readonly delegations?: ReadonlyArray<AutoDelegation>;
  readonly artifacts?: ReadonlyArray<AutoArtifactLedgerRow>;
  readonly spentUsd?: number;
  readonly reservedUsd?: number;
  readonly capUsd?: number;
  readonly pendingRefusal?: AutoPendingRefusal | null;
  readonly pendingMessages?: ReadonlyArray<AutoPendingMessage>;
  readonly deliveredResults?: ReadonlyArray<AutoDeliveredResult>;
  readonly rootAsk?: string | null;
};

export const aView = ({
  phase = 'answering',
  delegations = [],
  artifacts = [],
  spentUsd = 0,
  reservedUsd = 0,
  capUsd = 10,
  pendingRefusal = null,
  pendingMessages = [],
  deliveredResults = [],
  rootAsk = null,
}: ViewParams = {}): AutoTreeView => ({
  hiddenChildIds: [],
  pendingRefusal,
  pendingMessages,
  deliveredResults,
  rootAsk,
  tree: aTree({ phase, capUsd }),
  delegations,
  artifacts,
  budget: autoBudgetOf({
    spend: autoTreeSpendOf({
      capUsd,
      settledUsd: spentUsd,
      liveUsd: 0,
      reservedUsd,
      estimatedUsd: 0,
    }),
  }),
});

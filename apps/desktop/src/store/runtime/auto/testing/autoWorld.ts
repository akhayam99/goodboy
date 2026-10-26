import { registerAutoArtifact, type Database } from '@goodboy/db';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import {
  AUTO_SEED_NOW,
  AUTO_SEED_ROOT,
  seedAutoSession,
  seedAutoTree,
  seedPlanArtifact,
} from '@goodboy/db/test-helpers/auto-seeds';
import {
  brandId,
  type AgentId,
  type ArtifactId,
  type AutoAttemptId,
  type AutoBatchId,
  type AutoDelegationId,
  type AutoRequestId,
  type AutoTreeId,
} from '@goodboy/types';
import type { AdmitBatchParams, AdmitChildInput } from '../admit';
import { createAutoScheduler, type AutoScheduler } from '../scheduler';

export const WORLD_NOW = AUTO_SEED_NOW;
export const WORLD_TREE = brandId<AutoTreeId>({ value: 'tree-1' });
export const WORLD_RUN = 'run-auto-1';

type AdvanceParams = {
  readonly ms: number;
};

export type TestClock = {
  now: () => number;
  advance: (params: AdvanceParams) => void;
};

export const makeTestClock = (): TestClock => {
  let current = WORLD_NOW;
  return {
    now: () => current,
    advance: ({ ms }) => {
      current += ms;
    },
  };
};

export type AutoWorld = Readonly<{
  db: Database;
  clock: TestClock;
  scheduler: AutoScheduler;
}>;

type WorldParams = {
  readonly agentIds?: ReadonlyArray<string>;
  readonly capUsd?: number;
  readonly planIds?: ReadonlyArray<Readonly<{ id: string; agentId: string }>>;
  readonly isDeciding?: boolean;
};

export const makeAutoWorld = async ({
  agentIds = [],
  capUsd = 5,
  planIds = [],
  isDeciding = true,
}: WorldParams = {}): Promise<AutoWorld> => {
  const db = await makeMigratedTestDatabase();
  await seedAutoSession({ db, agentIds });
  await seedAutoTree({ db, capUsd });
  for (const plan of planIds) {
    await seedPlanArtifact({ db, id: plan.id, agentId: plan.agentId });
  }
  const clock = makeTestClock();
  const scheduler = createAutoScheduler({ db, ownerId: 'window-a', now: clock.now });
  await scheduler.claim({ treeId: WORLD_TREE });
  if (isDeciding) {
    await scheduler.transition({
      treeId: WORLD_TREE,
      expect: { phaseRev: 0, generation: 1, from: ['answering'] },
      to: 'deciding',
      patch: { activeRunId: WORLD_RUN, isNewTurn: true },
    });
  }
  return { db, clock, scheduler };
};

type SecondSchedulerParams = {
  readonly world: AutoWorld;
  readonly ownerId?: string;
};

export const secondScheduler = ({
  world,
  ownerId = 'window-b',
}: SecondSchedulerParams): AutoScheduler =>
  createAutoScheduler({ db: world.db, ownerId, now: world.clock.now });

type ChildParams = {
  readonly key: string;
  readonly role?: AdmitChildInput['role'];
  readonly request?: AdmitChildInput['request'];
  readonly reviseOf?: AdmitChildInput['reviseOf'];
  readonly inputArtifacts?: AdmitChildInput['inputArtifacts'];
  readonly isConfirmForced?: boolean;
  readonly agentId?: string;
};

export const childInput = ({
  key,
  role = 'scout',
  request = { task: `look into ${key} in ledger-core` },
  reviseOf = null,
  inputArtifacts = [],
  isConfirmForced = false,
  agentId = `agent-${key}`,
}: ChildParams): AdmitChildInput => ({
  delegationId: brandId<AutoDelegationId>({ value: `delegation-${key}` }),
  childAgentId: brandId<AgentId>({ value: agentId }),
  attemptId: brandId<AutoAttemptId>({ value: `attempt-${key}` }),
  role,
  request,
  target: { mountId: 'mount-ledger-core', revision: 'abc123' },
  routing: { provider: 'anthropic', model: 'sonnet', effort: 'medium' },
  reviseOf,
  inputArtifacts,
  isConfirmForced,
  deadlineAt: WORLD_NOW + 30 * 60 * 1000,
});

type BatchParams = {
  readonly requestId?: string;
  readonly requestHash?: string;
  readonly children: ReadonlyArray<AdmitChildInput>;
  readonly runId?: string;
  readonly generation?: number;
  readonly isPlanApprovalRequired?: boolean;
};

export const batchInput = ({
  requestId = 'request-1',
  requestHash = 'hash-1',
  children,
  runId = WORLD_RUN,
  generation = 1,
  isPlanApprovalRequired = true,
}: BatchParams): Omit<AdmitBatchParams, 'db' | 'ownerId' | 'nowMs'> => ({
  treeId: WORLD_TREE,
  callerAgentId: AUTO_SEED_ROOT,
  generation,
  runId,
  requestId: brandId<AutoRequestId>({ value: requestId }),
  requestHash,
  batchId: brandId<AutoBatchId>({ value: `batch-${requestId}` }),
  children,
  isPlanApprovalRequired,
});

type PlanRefParams = {
  readonly id: string;
  readonly revision: number;
};

export const planRef = ({
  id,
  revision,
}: PlanRefParams): Readonly<{ artifactId: ArtifactId; revision: number }> => ({
  artifactId: brandId<ArtifactId>({ value: id }),
  revision,
});

type RegisterPlanParams = {
  readonly world: AutoWorld;
  readonly id: string;
  readonly agentId: string;
  readonly delegationId?: string;
};

export const registerPlan = async ({
  world,
  id,
  agentId,
  delegationId = 'delegation-plan',
}: RegisterPlanParams): Promise<void> => {
  await registerAutoArtifact({
    db: world.db,
    artifact: {
      artifactId: brandId<ArtifactId>({ value: id }),
      treeId: WORLD_TREE,
      kind: 'plan',
      ownerAgentId: brandId<AgentId>({ value: agentId }),
      ownerDelegationId: brandId<AutoDelegationId>({ value: delegationId }),
      ownerRole: 'planner',
      nowMs: WORLD_NOW,
    },
  });
};

type NewTurnParams = {
  readonly world: AutoWorld;
  readonly expectedPhaseRev: number;
  readonly from: ReadonlyArray<'delegating' | 'waiting' | 'merging' | 'blocked' | 'done'>;
};

export const startNewTurn = ({ world, expectedPhaseRev, from }: NewTurnParams) =>
  world.scheduler.transition({
    treeId: WORLD_TREE,
    expect: { phaseRev: expectedPhaseRev, generation: 1, from },
    to: 'deciding',
    patch: { isYieldRequested: false, isNewTurn: true, activeRunId: WORLD_RUN },
  });

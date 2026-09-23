import {
  bindClusterAttemptLease,
  bindClusterAttemptMount,
  claimClusterAttempt,
  recordClusterAttemptPreparation,
  settleClusterAttempt,
  type ClusterAttemptPreparationRecord,
} from '@goodboy/db';
import type {
  AgentId,
  CheckoutPreparation,
  ClusterAttemptBinding,
  ClusterAttemptTarget,
  Project,
  SessionId,
} from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { prepareCheckout } from '../../../features/worktree/worktree';
import {
  acquireApplicationWriterLease,
  worktreeWriterResource,
  type OwnedReservation,
} from '../../../features/worktree/writerLease';
import { tauriDatabase } from '../../../shared/lib/db';
import { persistExecutionEligibility } from './evaluateExecutionEligibility';
import { mergeClusterAttempt } from './mergeClusterAttempt';
import { resolveClusterSessionTarget } from './resolveClusterSessionTarget';
import type { GetFn, SetFn } from './types';

export type PrepareClusterAttemptInput = {
  readonly sessionId: SessionId;
  readonly containerAgentId: AgentId;
  readonly nodeId: string;
  readonly requestId: string;
};

export type PrepareClusterAttemptResult =
  | Readonly<{ kind: 'prepared'; attempt: ClusterAttemptBinding }>
  | Readonly<{ kind: 'ineligible'; reason: string; attempt: ClusterAttemptBinding | null }>
  | Readonly<{ kind: 'busy'; attempt: ClusterAttemptBinding }>;

const OWNING_STATES: ReadonlySet<ClusterAttemptBinding['state']> = new Set([
  'allocated',
  'prepared',
]);

type AttemptLeaseHolderParams = {
  readonly attemptId: string;
};

export const attemptLeaseHolder = ({ attemptId }: AttemptLeaseHolderParams): string =>
  `cluster-attempt:${attemptId}`;

type AttemptResourceParams = {
  readonly target: ClusterAttemptTarget;
};

const attemptResources = ({ target }: AttemptResourceParams): ReadonlyArray<string> => [
  worktreeWriterResource({ repoRoot: target.repoRoot, worktreePath: target.worktreePath }),
];

type OwnedSiblingsParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly attemptId: string;
  readonly repoRoot: string;
};

const ownedSiblingReservations = async ({
  get,
  sessionId,
  attemptId,
  repoRoot,
}: OwnedSiblingsParams): Promise<ReadonlyArray<OwnedReservation>> => {
  const siblings = (get().clusterAttempts?.[sessionId] ?? []).filter(
    (candidate) =>
      candidate.id !== attemptId &&
      OWNING_STATES.has(candidate.state) &&
      candidate.leaseId !== null &&
      candidate.target !== null &&
      candidate.target.repoRoot === repoRoot,
  );
  const owned: OwnedReservation[] = [];
  for (const sibling of siblings) {
    if (sibling.target === null) {
      continue;
    }
    const lease = await acquireApplicationWriterLease({
      holder: attemptLeaseHolder({ attemptId: sibling.id }),
      resources: attemptResources({ target: sibling.target }),
    });
    if (lease.outcome === 'granted' && lease.leaseId === sibling.leaseId) {
      owned.push({ leaseId: lease.leaseId, token: lease.token });
    }
  }
  return owned;
};

type StoreAttemptParams = {
  readonly set: SetFn;
  readonly attempt: ClusterAttemptBinding;
};

const storeAttempt = ({ set, attempt }: StoreAttemptParams): ClusterAttemptBinding => {
  set((state) => mergeClusterAttempt({ state, attempt }));
  return attempt;
};

type SequentialParams = {
  readonly set: SetFn;
  readonly attempt: ClusterAttemptBinding;
  readonly reason: string;
  readonly targetMountId: ClusterAttemptTarget['mountId'] | null;
};

const fallBackToSequential = async ({
  set,
  attempt,
  reason,
  targetMountId,
}: SequentialParams): Promise<PrepareClusterAttemptResult> => {
  await persistExecutionEligibility({
    set,
    eligibility: {
      containerAgentId: attempt.containerAgentId,
      sessionId: attempt.sessionId,
      graphRevision: attempt.graphRevision,
      state: 'sequential',
      reason,
      targetMountId,
      targetHeadSha: null,
    },
  });
  return { kind: 'ineligible', reason, attempt };
};

type SettleParams = {
  readonly set: SetFn;
  readonly attempt: ClusterAttemptBinding;
  readonly reason: string;
  readonly targetMountId: ClusterAttemptTarget['mountId'] | null;
};

const failAttempt = async ({
  set,
  attempt,
  reason,
  targetMountId,
}: SettleParams): Promise<PrepareClusterAttemptResult> => {
  const settled = await settleClusterAttempt({
    db: tauriDatabase,
    id: attempt.id,
    state: 'failed',
    reason,
  });
  storeAttempt({ set, attempt: settled });
  return fallBackToSequential({ set, attempt: settled, reason, targetMountId });
};

type PreparationRecordParams = {
  readonly preparation: CheckoutPreparation;
};

const toPreparationRecord = ({
  preparation,
}: PreparationRecordParams): ClusterAttemptPreparationRecord => ({
  result: preparation.outcome,
  exitCode: preparation.exitCode,
  output: preparation.output,
  baseline: preparation.baseline,
  reason:
    preparation.reason ??
    (preparation.outcome === 'succeeded' ? null : `setup ended as ${preparation.outcome}`),
});

type AllocateParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly attempt: ClusterAttemptBinding;
  readonly project: Project;
  readonly nodeTitle: string;
  readonly sessionTargetPath: string;
  readonly targetMountId: ClusterAttemptTarget['mountId'];
};

const allocateAndPrepare = async ({
  set,
  get,
  attempt,
  project,
  nodeTitle,
  sessionTargetPath,
  targetMountId,
}: AllocateParams): Promise<PrepareClusterAttemptResult> => {
  let bound = attempt;
  if (bound.target === null) {
    const ownedReservations = await ownedSiblingReservations({
      get,
      sessionId: bound.sessionId,
      attemptId: bound.id,
      repoRoot: project.rootPath,
    });
    let mount;
    try {
      mount = await get().forkMount({
        sessionId: bound.sessionId,
        projectId: project.id,
        requestId: attemptLeaseHolder({ attemptId: bound.id }),
        exactBaseSha: bound.baseSha,
        mountName: `${nodeTitle} (attempt ${bound.attemptNumber})`,
        ownedReservations,
      });
    } catch (error) {
      return failAttempt({
        set,
        attempt: bound,
        reason: `the private checkout could not be allocated: ${formatError(error)}`,
        targetMountId,
      });
    }
    if (mount.worktreePath === null) {
      return failAttempt({
        set,
        attempt: bound,
        reason: 'the private checkout was allocated without a path',
        targetMountId,
      });
    }
    bound = storeAttempt({
      set,
      attempt: await bindClusterAttemptMount({
        db: tauriDatabase,
        id: bound.id,
        target: {
          mountId: mount.id,
          mountRevision: mount.revision,
          worktreePath: mount.worktreePath,
          branch: mount.branch,
          repoRoot: project.rootPath,
        },
      }),
    });
  }
  const target = bound.target;
  if (target === null) {
    return failAttempt({
      set,
      attempt: bound,
      reason: 'the attempt lost its private checkout binding',
      targetMountId,
    });
  }
  const lease = await acquireApplicationWriterLease({
    holder: attemptLeaseHolder({ attemptId: bound.id }),
    resources: attemptResources({ target }),
  });
  switch (lease.outcome) {
    case 'denied': {
      return failAttempt({
        set,
        attempt: bound,
        reason: `the private checkout is held by ${lease.blockedBy} (${lease.blockedState})`,
        targetMountId,
      });
    }
    case 'refused': {
      return failAttempt({ set, attempt: bound, reason: lease.reason, targetMountId });
    }
    case 'granted': {
      break;
    }
    default: {
      const exhaustive: never = lease;
      return exhaustive;
    }
  }
  bound = storeAttempt({
    set,
    attempt: await bindClusterAttemptLease({
      db: tauriDatabase,
      id: bound.id,
      leaseId: lease.leaseId,
    }),
  });
  if (bound.state === 'prepared') {
    return { kind: 'prepared', attempt: bound };
  }
  const siblingRoots = [
    sessionTargetPath,
    ...(get().clusterAttempts?.[bound.sessionId] ?? []).flatMap((candidate) =>
      candidate.id === bound.id || candidate.target === null ? [] : [candidate.target.worktreePath],
    ),
  ];
  const preparation = await prepareCheckout({
    worktreePath: target.worktreePath,
    repoRoot: target.repoRoot,
    command: bound.setup.command,
    expectedHeadSha: bound.baseSha,
    siblingRoots,
  }).catch((error: unknown): CheckoutPreparation => ({
    outcome: 'failed',
    exitCode: null,
    output: '',
    baseline: null,
    reason: `setup could not run: ${formatError(error)}`,
  }));
  const recorded = storeAttempt({
    set,
    attempt: await recordClusterAttemptPreparation({
      db: tauriDatabase,
      id: bound.id,
      preparation: toPreparationRecord({ preparation }),
    }),
  });
  if (recorded.state === 'prepared') {
    return { kind: 'prepared', attempt: recorded };
  }
  return fallBackToSequential({
    set,
    attempt: recorded,
    reason: recorded.reason ?? 'the private checkout could not be prepared',
    targetMountId,
  });
};

export const prepareClusterAttempt = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    containerAgentId,
    nodeId,
    requestId,
  }: PrepareClusterAttemptInput): Promise<PrepareClusterAttemptResult> => {
    const execution = (get().clusterExecutionGraphs?.[sessionId] ?? []).find(
      (graph) => graph.containerAgentId === containerAgentId,
    );
    if (execution === undefined) {
      throw new Error(`cluster execution not found: ${containerAgentId}`);
    }
    const node = execution.graph.nodes.find((candidate) => candidate.id === nodeId);
    const binding = execution.nodes.find((candidate) => candidate.nodeId === nodeId);
    if (node === undefined || binding === undefined || binding.state !== 'active') {
      return { kind: 'ineligible', reason: `cluster ${nodeId} is not active`, attempt: null };
    }
    if (node.writeScope === undefined) {
      return {
        kind: 'ineligible',
        reason: `cluster ${nodeId} declares no write scope`,
        attempt: null,
      };
    }
    const target = resolveClusterSessionTarget({ state: get(), sessionId });
    const known = (get().clusterAttempts?.[sessionId] ?? []).find(
      (candidate) => candidate.requestId === requestId,
    );
    const eligibility =
      known === undefined
        ? await get().evaluateClusterExecutionEligibility({ sessionId, containerAgentId })
        : null;
    if (
      eligibility !== null &&
      (eligibility.state !== 'eligible' || eligibility.targetHeadSha === null)
    ) {
      return {
        kind: 'ineligible',
        reason: eligibility.reason ?? 'the execution is not eligible for private attempts',
        attempt: null,
      };
    }
    if (target === null) {
      return {
        kind: 'ineligible',
        reason: 'the session writes outside a repository checkout',
        attempt: null,
      };
    }
    const baseSha = eligibility?.targetHeadSha ?? known?.baseSha ?? null;
    if (baseSha === null) {
      return {
        kind: 'ineligible',
        reason: 'the session checkout head could not be pinned',
        attempt: null,
      };
    }
    const setup = target.project.setup;
    const claimed = await claimClusterAttempt({
      db: tauriDatabase,
      claim: {
        id: crypto.randomUUID(),
        requestId,
        containerAgentId,
        sessionId,
        nodeId,
        graphRevision: execution.revision,
        scopeRevision: binding.revision,
        writeScope: node.writeScope,
        baseSha,
        setupRevision: setup?.revision ?? null,
        setupCommand: setup?.kind === 'command' ? setup.command : null,
      },
    });
    const attempt = storeAttempt({ set, attempt: claimed.attempt });
    if (claimed.kind === 'busy') {
      return { kind: 'busy', attempt };
    }
    switch (attempt.state) {
      case 'prepared':
      case 'claimed':
      case 'allocated': {
        return allocateAndPrepare({
          set,
          get,
          attempt,
          project: target.project,
          nodeTitle: node.title,
          sessionTargetPath: target.mount.worktreePath,
          targetMountId: target.mount.mountId,
        });
      }
      case 'ineligible':
      case 'failed':
      case 'released': {
        return {
          kind: 'ineligible',
          reason: attempt.reason ?? `the attempt is ${attempt.state}`,
          attempt,
        };
      }
      default: {
        const exhaustive: never = attempt.state;
        return exhaustive;
      }
    }
  };
};

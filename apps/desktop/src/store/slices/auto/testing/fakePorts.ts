import type { CheckReport, MountSnapshot, PickableMount, RemoteRead } from '@goodboy/core';
import { AUTO_SEED_ROOT, AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import type {
  AgentGrant,
  AutoCheckScript,
  AutoPorts,
  CancelRunOutcome,
  CancelRunParams,
  ChildStartOutcome,
  DeliveryRun,
  EnsureChildAgentParams,
  BranchFactsParts,
  ListChecksParams,
  PublishScribeParams,
  PushBranchOutcome,
  PushBranchParams,
  ReadBranchFactsParams,
  ReadCommittedFilesParams,
  ReadRemoteHeadParams,
  RefreshSessionArtifactsParams,
  RestoreBackupOutcome,
  RestoreBackupParams,
  RoutingOutcome,
  RunCheckParams,
  RunOutcome,
  ScribePublication,
  StartAutoTurnParams,
  StartChildTurnParams,
  TurnStartOutcome,
} from '../ports';
import { WORLD_RUN, WORLD_TREE } from './autoWorld';

type CreateBackupParams = Parameters<AutoPorts['createBackup']>[0];

export const LEDGER_MOUNT: PickableMount = {
  id: 'mount-ledger-core',
  mountName: 'ledger-core',
  branch: 'ak/ledger-export',
  projectId: 'project-ledger-core',
  worktreePath: '/work/harborline/ledger-core',
  revision: 3,
  isAttached: true,
  diskState: 'present',
};

export const NOTIFY_MOUNT: PickableMount = {
  id: 'mount-notify-relay',
  mountName: 'notify-relay',
  branch: 'ak/notify-queue',
  projectId: 'project-notify-relay',
  worktreePath: '/work/harborline/notify-relay',
  revision: 5,
  isAttached: true,
  diskState: 'present',
};

export const WORLD_GRANT: AgentGrant = {
  agentId: AUTO_SEED_ROOT,
  treeId: WORLD_TREE,
  generation: 1,
  workspaceId: 'workspace-harborline',
  sessionId: AUTO_SEED_SESSION,
  runId: WORLD_RUN,
};

export const READY_ROUTING: RoutingOutcome = {
  kind: 'ready',
  provider: 'anthropic',
  model: 'sonnet',
  effort: 'medium',
  reason: 'a standard change fits a mid tier model',
  proposal: 'none',
};

export const CLEAN_SNAPSHOT: MountSnapshot = { head: 'abc123', entries: [], isPartial: false };

export const CLEAN_FACTS: BranchFactsParts = {
  commits: { kind: 'ok', value: [{ sha: 'abc123def', subject: 'feat: export the ledger' }] },
  request: {
    kind: 'ok',
    value: {
      host: 'github',
      number: 421,
      title: 'Export the ledger',
      url: 'https://github.com/harborline/ledger-core/pull/421',
      state: 'open',
      isDraft: false,
      baseBranch: 'main',
      headBranch: 'ak/ledger-export',
    },
  },
  threads: {
    kind: 'ok',
    value: [
      { author: 'northwind-dev', path: 'src/export.ts', body: 'rename it', isResolved: false },
    ],
  },
  checks: { kind: 'ok', value: [{ name: 'ci', conclusion: 'success' }] },
};

export type FakePorts = AutoPorts &
  Readonly<{
    autoTurns: Array<StartAutoTurnParams>;
    childTurns: Array<StartChildTurnParams>;
    ensuredChildren: Array<EnsureChildAgentParams>;
    refreshes: Array<RefreshSessionArtifactsParams>;
    cancels: Array<CancelRunParams>;
    liveRuns: Set<string>;
    runOutcomes: Map<string, RunOutcome>;
    deliveries: Map<string, DeliveryRun>;
    setMounts: (mounts: ReadonlyArray<PickableMount>) => void;
    setRouting: (routing: RoutingOutcome) => void;
    setPlanApproval: (isRequired: boolean) => void;
    setAutoTurnOutcome: (outcome: TurnStartOutcome | null) => void;
    setAutoTurnFailure: (error: Error | null) => void;
    setAutoTurnHang: (mode: 'none' | 'before_register' | 'after_register') => void;
    setChildOutcome: (outcome: ChildStartOutcome | null) => void;
    setSnapshots: (path: string, snapshots: ReadonlyArray<MountSnapshot | null>) => void;
    factReads: Array<ReadBranchFactsParams>;
    setBranchFacts: (mountId: string, parts: BranchFactsParts | Error | 'hang') => void;
    remoteReads: Array<ReadRemoteHeadParams>;
    setRemoteReads: (path: string, reads: ReadonlyArray<RemoteRead>) => void;
    committedReads: Array<ReadCommittedFilesParams>;
    setCommittedFiles: (path: string, files: ReadonlyArray<string> | Error) => void;
    checkRuns: Array<RunCheckParams>;
    checkLists: Array<ListChecksParams>;
    setChecks: (checks: ReadonlyArray<AutoCheckScript>) => void;
    setCheckResult: (id: string, result: CheckReport['status'] | Error) => void;
    setCheckGate: (gate: Promise<void> | null) => void;
    setCancelOutcome: (outcome: CancelRunOutcome, agentId?: string) => void;
    setEnsureFailure: (error: Error | null) => void;
    publications: Array<PublishScribeParams>;
    setPublications: (next: ReadonlyArray<ScribePublication>) => void;
    pushes: Array<PushBranchParams>;
    setPushOutcomes: (next: ReadonlyArray<PushBranchOutcome | Error>) => void;
    backups: Array<CreateBackupParams>;
    setBackupFailure: (error: Error | null) => void;
    restores: Array<RestoreBackupParams>;
    setRestoreOutcome: (outcome: RestoreBackupOutcome) => void;
  }>;

export const OPENED_PR: ScribePublication = {
  kind: 'opened',
  number: 421,
  url: 'https://github.com/harborline/ledger-core/pull/421',
};

type FakePortsParams = {
  readonly idPrefix?: string;
  readonly deliveries?: Map<string, DeliveryRun>;
  readonly liveRuns?: Set<string>;
  readonly runOutcomes?: Map<string, RunOutcome>;
};

export const makeFakePorts = ({
  idPrefix = 'id',
  deliveries = new Map<string, DeliveryRun>(),
  liveRuns = new Set<string>(),
  runOutcomes = new Map<string, RunOutcome>(),
}: FakePortsParams = {}): FakePorts => {
  let counter = 0;
  let mounts: ReadonlyArray<PickableMount> = [LEDGER_MOUNT, NOTIFY_MOUNT];
  let routing: RoutingOutcome = READY_ROUTING;
  let isApprovalRequired = true;
  let forcedOutcome: TurnStartOutcome | null = null;
  let forcedChildOutcome: ChildStartOutcome | null = null;
  let failure: Error | null = null;
  let hangMode: 'none' | 'before_register' | 'after_register' = 'none';
  let ensureFailure: Error | null = null;
  let cancelOutcome: CancelRunOutcome = { outcome: 'exited' };
  const cancelOutcomes = new Map<string, CancelRunOutcome>();
  const snapshots = new Map<string, Array<MountSnapshot | null>>();
  const remoteQueues = new Map<string, Array<RemoteRead>>();
  const remoteReads: Array<ReadRemoteHeadParams> = [];
  const factReads: Array<ReadBranchFactsParams> = [];
  const branchFacts = new Map<string, BranchFactsParts | Error | 'hang'>();
  const committedFiles = new Map<string, ReadonlyArray<string> | Error>();
  const committedReads: Array<ReadCommittedFilesParams> = [];
  const checkRuns: Array<RunCheckParams> = [];
  const checkLists: Array<ListChecksParams> = [];
  const checkResults = new Map<string, CheckReport['status'] | Error>();
  let ticked: ReadonlyArray<AutoCheckScript> = [];
  let checkGate: Promise<void> | null = null;
  const autoTurns: Array<StartAutoTurnParams> = [];
  const childTurns: Array<StartChildTurnParams> = [];
  const ensuredChildren: Array<EnsureChildAgentParams> = [];
  const refreshes: Array<RefreshSessionArtifactsParams> = [];
  const cancels: Array<CancelRunParams> = [];
  const publications: Array<PublishScribeParams> = [];
  const publicationQueue: Array<ScribePublication> = [];
  const pushes: Array<PushBranchParams> = [];
  const pushQueue: Array<PushBranchOutcome | Error> = [];
  const backups: Array<CreateBackupParams> = [];
  const restores: Array<RestoreBackupParams> = [];
  let backupFailure: Error | null = null;
  let restoreOutcome: RestoreBackupOutcome = { kind: 'restored' };
  return {
    autoTurns,
    childTurns,
    ensuredChildren,
    refreshes,
    cancels,
    liveRuns,
    runOutcomes,
    deliveries,
    setMounts: (next) => {
      mounts = next;
    },
    setRouting: (next) => {
      routing = next;
    },
    setPlanApproval: (isRequired) => {
      isApprovalRequired = isRequired;
    },
    setAutoTurnOutcome: (next) => {
      forcedOutcome = next;
    },
    setAutoTurnFailure: (next) => {
      failure = next;
    },
    setAutoTurnHang: (mode) => {
      hangMode = mode;
    },
    setChildOutcome: (next) => {
      forcedChildOutcome = next;
    },
    setSnapshots: (path, next) => {
      snapshots.set(path, [...next]);
    },
    factReads,
    setBranchFacts: (mountId, next) => {
      branchFacts.set(mountId, next);
    },
    remoteReads,
    setRemoteReads: (path, next) => {
      remoteQueues.set(path, [...next]);
    },
    committedReads,
    setCommittedFiles: (path, next) => {
      committedFiles.set(path, next);
    },
    checkRuns,
    checkLists,
    setChecks: (next) => {
      ticked = next;
    },
    setCheckResult: (id, next) => {
      checkResults.set(id, next);
    },
    setCheckGate: (next) => {
      checkGate = next;
    },
    setCancelOutcome: (next, agentId) => {
      if (agentId === undefined) {
        cancelOutcome = next;
        return;
      }
      cancelOutcomes.set(agentId, next);
    },
    setEnsureFailure: (next) => {
      ensureFailure = next;
    },
    newId: () => {
      counter += 1;
      return `${idPrefix}-${counter}`;
    },
    refreshSessionArtifacts: async (params) => {
      refreshes.push(params);
    },
    loadMounts: async () => mounts,
    resolveRouting: async () => routing,
    isPlanApprovalRequired: () => isApprovalRequired,
    startAutoTurn: async (params) => {
      if (failure !== null) {
        throw failure;
      }
      autoTurns.push(params);
      if (hangMode === 'before_register') {
        return new Promise<TurnStartOutcome>(() => undefined);
      }
      if (hangMode === 'after_register') {
        deliveries.set(params.deliveryId, { runId: params.runId, isLive: true });
        liveRuns.add(params.runId);
        return new Promise<TurnStartOutcome>(() => undefined);
      }
      if (forcedOutcome !== null) {
        return forcedOutcome;
      }
      const existing = deliveries.get(params.deliveryId);
      if (existing !== undefined) {
        return { kind: 'duplicate', runId: existing.runId };
      }
      deliveries.set(params.deliveryId, { runId: params.runId, isLive: true });
      return { kind: 'started', runId: params.runId };
    },
    lookupDeliveryRun: async ({ deliveryId }) => deliveries.get(deliveryId) ?? null,
    ensureChildAgent: async (params) => {
      if (ensureFailure !== null) {
        throw ensureFailure;
      }
      ensuredChildren.push(params);
    },
    startChildTurn: async (params) => {
      childTurns.push(params);
      if (forcedChildOutcome !== null) {
        return forcedChildOutcome;
      }
      const key = String(params.attemptId);
      const existing = deliveries.get(key);
      if (existing !== undefined) {
        return { kind: 'duplicate', runId: existing.runId };
      }
      deliveries.set(key, { runId: params.runId, isLive: true });
      return { kind: 'started', runId: params.runId };
    },
    readMountSnapshot: async ({ worktreePath }) => {
      const queue = snapshots.get(worktreePath);
      if (queue === undefined || queue.length === 0) {
        return CLEAN_SNAPSHOT;
      }
      const next = queue.length === 1 ? queue[0] : queue.shift();
      return next ?? null;
    },
    readCommittedFiles: async (params) => {
      committedReads.push(params);
      const next = committedFiles.get(params.worktreePath) ?? [];
      if (next instanceof Error) {
        throw next;
      }
      return next;
    },
    readRemoteHead: async (params) => {
      remoteReads.push(params);
      const queue = remoteQueues.get(params.worktreePath);
      const next = queue === undefined ? undefined : queue.length <= 1 ? queue[0] : queue.shift();
      return (
        next ?? {
          kind: 'sha',
          branch: params.branch ?? LEDGER_MOUNT.branch,
          sha: 'remote111',
        }
      );
    },
    readBranchFacts: async (params) => {
      factReads.push(params);
      const next = branchFacts.get(params.mountId) ?? CLEAN_FACTS;
      if (next === 'hang') {
        return new Promise<BranchFactsParts>(() => undefined);
      }
      if (next instanceof Error) {
        throw next;
      }
      return next;
    },
    listChecks: async (params) => {
      checkLists.push(params);
      return ticked;
    },
    runCheck: async (params) => {
      checkRuns.push(params);
      if (checkGate !== null) {
        await checkGate;
      }
      const result = checkResults.get(params.check.id) ?? 'pass';
      if (result instanceof Error) {
        throw result;
      }
      return result;
    },
    cancelRun: async (params) => {
      cancels.push(params);
      return cancelOutcomes.get(params.agentId) ?? cancelOutcome;
    },
    isRunLive: async ({ runId }) => liveRuns.has(runId),
    readRunOutcome: async ({ runId }) => runOutcomes.get(runId) ?? null,
    publications,
    setPublications: (next) => {
      publicationQueue.splice(0, publicationQueue.length, ...next);
    },
    publishScribePullRequest: async (params) => {
      publications.push(params);
      return publicationQueue.shift() ?? OPENED_PR;
    },
    pushes,
    setPushOutcomes: (next) => {
      pushQueue.splice(0, pushQueue.length, ...next);
    },
    pushBranch: async (params) => {
      pushes.push(params);
      const next = pushQueue.shift() ?? { kind: 'pushed' };
      if (next instanceof Error) {
        throw next;
      }
      return next;
    },
    backups,
    setBackupFailure: (next) => {
      backupFailure = next;
    },
    createBackup: async (params) => {
      backups.push(params);
      if (backupFailure !== null) {
        throw backupFailure;
      }
      return `refs/goodboy/backup/b-${backups.length}/keep-1`;
    },
    restores,
    setRestoreOutcome: (next) => {
      restoreOutcome = next;
    },
    restoreBackup: async (params) => {
      restores.push(params);
      return restoreOutcome;
    },
  };
};

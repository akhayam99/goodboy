import type { MountSnapshot, PickableMount } from '@goodboy/core';
import { AUTO_SEED_ROOT, AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import type {
  AgentGrant,
  AutoPorts,
  CancelRunOutcome,
  CancelRunParams,
  ChildStartOutcome,
  DeliveryRun,
  EnsureChildAgentParams,
  PublishScribeParams,
  RefreshSessionArtifactsParams,
  RoutingOutcome,
  RunOutcome,
  ScribePublication,
  StartAutoTurnParams,
  StartChildTurnParams,
  TurnStartOutcome,
} from '../ports';
import { WORLD_RUN, WORLD_TREE } from './autoWorld';

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
    setCancelOutcome: (outcome: CancelRunOutcome, agentId?: string) => void;
    setEnsureFailure: (error: Error | null) => void;
    publications: Array<PublishScribeParams>;
    setPublications: (next: ReadonlyArray<ScribePublication>) => void;
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
  const autoTurns: Array<StartAutoTurnParams> = [];
  const childTurns: Array<StartChildTurnParams> = [];
  const ensuredChildren: Array<EnsureChildAgentParams> = [];
  const refreshes: Array<RefreshSessionArtifactsParams> = [];
  const cancels: Array<CancelRunParams> = [];
  const publications: Array<PublishScribeParams> = [];
  const publicationQueue: Array<ScribePublication> = [];
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
  };
};

import { pathsOfPatch, type PickableMount } from '@goodboy/core';
import { readRunCostUsd, readRunLedgerOutcome, type Database } from '@goodboy/db';
import {
  brandId,
  type MountId,
  type ProviderRunId,
  type SessionMountView,
  type SessionId,
} from '@goodboy/types';
import type { DeliveryRun } from '../../../features/chat/turn';
import type { WorktreeSnapshot } from '../../../features/worktree/worktree';
import type { AppStore } from '../../store';
import type { CancelOutcome } from '../../slices/turn/cancelTurnConfirmed';
import type { SendTurnInput, SendTurnResult } from '../../slices/turn/types';
import { makeEnsureChildAgent, type RefreshAgentsParams } from './makeEnsureChildAgent';
import type {
  AutoPorts,
  CancelRunParams,
  ChildStartOutcome,
  LookupDeliveryRunParams,
  ReadCommittedFilesParams,
  ReadMountSnapshotParams,
  StartChildTurnParams,
} from './ports';
import { listAutoChecks } from './listAutoChecks';
import { mountAutoTaskFolders } from './mountAutoTaskFolders';
import {
  makeBranchFactsReaders,
  type MakeBranchFactsReadersParams,
} from './makeBranchFactsReaders';
import { readBranchFactsOf } from './branchFacts/readBranchFactsOf';
import { resolveChildRouting } from './resolveChildRouting';
import { runAutoCheckScript } from './runAutoCheckScript';
import { createHistoryBackup } from '../../../features/history/historyEngine';
import { publishScribePullRequest } from './publishScribePullRequest';
import { pushAutoBranch } from './pushAutoBranch';
import { restoreAutoBackup } from './restoreAutoBackup';
import { readRemoteHead, type BranchOfParams, type RemoteHeadReaders } from './readRemoteHead';
import { makeStartAutoTurn } from './startAutoTurn';
import { startDeliveredTurn, type ReadRunCostParams, type SleepParams } from './startDeliveredTurn';

const CHILD_TURN_ACCEPT_TIMEOUT_MS = 31 * 60 * 1000;

export type RealAutoPortsDeps = Readonly<{
  db: Database;
  getState: () => AppStore;
  sendTurn: (input: SendTurnInput) => Promise<SendTurnResult>;
  cancelTurnConfirmed: (params: {
    readonly sessionId: SessionId;
    readonly agentId: CancelRunParams['agentId'];
    readonly reason: 'user';
  }) => Promise<CancelOutcome>;
  loadSessionMounts: (params: {
    readonly sessionId: SessionId;
  }) => Promise<ReadonlyArray<SessionMountView>>;
  refreshAgents: (params: RefreshAgentsParams) => Promise<void>;
  refreshSessionArtifacts: AutoPorts['refreshSessionArtifacts'];
  lookupDeliveryRun: (params: LookupDeliveryRunParams) => Promise<DeliveryRun | null>;
  worktreeSnapshot: (params: ReadMountSnapshotParams) => Promise<WorktreeSnapshot>;
  worktreeDiffRange: (params: ReadCommittedFilesParams) => Promise<string>;
  worktreeCommitRange: MakeBranchFactsReadersParams['commitRange'];
  worktreeStatus: (params: BranchOfParams) => Promise<Readonly<{ branch: string | null }>>;
  worktreeRemoteHead: RemoteHeadReaders['remoteHeadOf'];
  listLiveRunIds: () => Promise<ReadonlySet<string>>;
  isPlanApprovalRequired: () => boolean;
  sleep: (params: SleepParams) => Promise<void>;
  nowMs: () => number;
  newId: () => string;
}>;

type PickableOfParams = {
  readonly view: SessionMountView;
};

const pickableOf = ({ view }: PickableOfParams): PickableMount => ({
  id: view.id,
  mountName: view.mountName,
  branch: view.branch,
  projectId: view.projectId,
  worktreePath: view.worktreePath,
  revision: view.revision,
  isAttached: view.isAttached,
  diskState: view.diskState,
});

export const createRealAutoPorts = (deps: RealAutoPortsDeps): AutoPorts => {
  const deliveredDeps = {
    sendTurn: deps.sendTurn,
    lookupDeliveryRun: deps.lookupDeliveryRun,
    readRunCostUsd: ({ runId }: ReadRunCostParams) => readRunCostUsd({ db: deps.db, runId }),
    sleep: deps.sleep,
    nowMs: deps.nowMs,
  };
  const startChildTurn = async (params: StartChildTurnParams): Promise<ChildStartOutcome> => {
    const outcome = await startDeliveredTurn({
      deps: deliveredDeps,
      input: {
        sessionId: params.sessionId,
        agentId: params.childAgentId,
        content: params.text,
        ...(params.images !== undefined &&
          params.images.length > 0 && { storedAttachments: params.images }),
        origin: 'delegation',
        confinedRole: params.role,
        mountTarget: {
          mountId: brandId<MountId>({ value: params.mountTarget.mountId }),
          mountRevision: params.mountTarget.mountRevision,
          worktreePath: params.mountTarget.worktreePath,
        },
        captureMode: params.captureMode,
        ...(params.briefVersion !== undefined && { briefVersion: params.briefVersion }),
      },
      runId: brandId<ProviderRunId>({ value: params.runId }),
      deliveryId: String(params.attemptId),
      acceptTimeoutMs: CHILD_TURN_ACCEPT_TIMEOUT_MS,
      onEnded: (ended) => {
        params.onEnded({
          treeId: params.treeId,
          generation: params.generation,
          delegationId: params.delegationId,
          attemptId: params.attemptId,
          runId: params.runId,
          childAgentId: params.childAgentId,
          sessionId: params.sessionId,
          assistantText: ended.assistantText,
          exit: ended.exit,
          costUsd: ended.costUsd,
          filesTouched: ended.filesTouched,
          durationMs: ended.durationMs,
        });
      },
    });
    if (outcome.kind === 'refused') {
      return {
        kind: 'refused',
        reason: outcome.isLeaseDenied ? 'lease_busy' : 'kickoff_failed',
        message: outcome.message,
      };
    }
    return outcome;
  };
  return {
    newId: deps.newId,
    refreshSessionArtifacts: deps.refreshSessionArtifacts,
    loadMounts: async ({ sessionId }) =>
      (await deps.loadSessionMounts({ sessionId })).map((view) => pickableOf({ view })),
    mountTaskFolders: (params) => mountAutoTaskFolders({ get: deps.getState, params }),
    resolveRouting: async (request) =>
      resolveChildRouting({ state: deps.getState(), request, nowMs: deps.nowMs() }),
    isPlanApprovalRequired: deps.isPlanApprovalRequired,
    startAutoTurn: makeStartAutoTurn(deliveredDeps),
    lookupDeliveryRun: deps.lookupDeliveryRun,
    ensureChildAgent: makeEnsureChildAgent({ db: deps.db, refreshAgents: deps.refreshAgents }),
    startChildTurn,
    readMountSnapshot: ({ worktreePath }) => deps.worktreeSnapshot({ worktreePath }),
    readCommittedFiles: async (params) =>
      pathsOfPatch({ patch: await deps.worktreeDiffRange(params) }),
    readRemoteHead: (params) =>
      readRemoteHead({
        readers: {
          branchOf: async (found) => (await deps.worktreeStatus(found)).branch,
          remoteHeadOf: deps.worktreeRemoteHead,
        },
        params,
      }),
    readBranchFacts: (params) =>
      readBranchFactsOf({
        readers: makeBranchFactsReaders({
          getState: deps.getState,
          commitRange: deps.worktreeCommitRange,
        }),
        params,
      }),
    listChecks: (params) => listAutoChecks({ getState: deps.getState, params }),
    runCheck: (params) => runAutoCheckScript({ getState: deps.getState, params }),
    cancelRun: async ({ sessionId, agentId }) => {
      const cancelled = await deps.cancelTurnConfirmed({ sessionId, agentId, reason: 'user' });
      return { outcome: cancelled.outcome };
    },
    isRunLive: async ({ runId }) => (await deps.listLiveRunIds()).has(runId),
    readRunOutcome: ({ runId, agentId }) => readRunLedgerOutcome({ db: deps.db, runId, agentId }),
    publishScribePullRequest: (params) =>
      publishScribePullRequest({ getState: deps.getState, params }),
    pushBranch: (params) => pushAutoBranch({ getState: deps.getState, params }),
    createBackup: (params) => createHistoryBackup(params),
    restoreBackup: (params) => restoreAutoBackup(params),
  };
};

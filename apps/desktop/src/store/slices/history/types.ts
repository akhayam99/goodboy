import type {
  AgentId,
  BranchCommit,
  HistoryGraph,
  HistoryPlanArgs,
  HistoryPlanPrediction,
  HistoryStep,
  HistoryShaMove,
  HistoryTrialProgress,
  MountId,
  ProjectId,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import type { HistoryAction } from '../../../features/history/historyRowMarks';

export type { SetFn, GetFn } from '../../slice-types';

export type HistoryRunOrigin = 'plan' | 'rebase';

export type HistoryRunPhase =
  | 'predicting'
  | 'trying'
  | 'waiting'
  | 'applying'
  | 'pushing'
  | 'rewriting'
  | 'rewritten'
  | 'applied'
  | 'pushed'
  | 'restored'
  | 'stopped';

export type HistoryStopReason =
  | 'conflict'
  | 'hook'
  | 'stuck'
  | 'invalid'
  | 'unverified'
  | 'origin-moved'
  | 'head-moved'
  | 'blocked'
  | 'failed';

export type HistoryStop = {
  readonly reason: HistoryStopReason;
  readonly message: string;
  readonly files: ReadonlyArray<string>;
  readonly sha: string | null;
};

export type HistoryIdentity = {
  readonly worktreePath: string;
  readonly branch: string;
  readonly projectId: ProjectId;
};

type HistoryRewriteResult = {
  readonly head: string;
  readonly expectedHead: string;
  readonly map: ReadonlyArray<HistoryShaMove>;
  readonly isTreeEqual: boolean;
  readonly changedFiles: ReadonlyArray<string>;
  readonly byAgent: boolean;
  readonly identity: HistoryIdentity;
};

export type HistoryRun = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly origin: HistoryRunOrigin;
  readonly phase: HistoryRunPhase;
  readonly planId: string | null;
  readonly agentId: AgentId | null;
  readonly copyPath: string | null;
  readonly stop: HistoryStop | null;
  readonly result: HistoryRewriteResult | null;
  readonly backupRef: string | null;
  readonly remoteSha: string | null;
  readonly holder: string | null;
  readonly progress: HistoryTrialProgress | null;
  readonly applied: HistoryApplied | null;
  readonly identity: HistoryIdentity | null;
  readonly movedHead: string | null;
  readonly updatedAt: number;
};

type HistoryAppliedLine = {
  readonly action: HistoryAction;
  readonly text: string;
};

export type HistoryApplied = {
  readonly before: number;
  readonly after: number;
  readonly lines: ReadonlyArray<HistoryAppliedLine>;
  readonly includes: Readonly<Record<string, ReadonlyArray<string>>>;
  readonly newShas: ReadonlyArray<string>;
  readonly touchedOnline: number;
  readonly isSameCode: boolean;
  readonly isOnMain: boolean;
  readonly removedFiles: ReadonlyArray<string>;
};

export type HistoryRewriterBinding = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly copyPath: string;
  readonly plan: HistoryPlanArgs;
  readonly origin: HistoryRunOrigin;
  readonly planId: string | null;
  readonly identity: HistoryIdentity;
};

export type HistoryTarget = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly workspaceId: WorkspaceId | null;
  readonly worktreePath: string;
  readonly branch: string;
  readonly baseBranch: string | null;
  readonly projectName: string;
};

export type HistoryMountInput = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

export type RebaseBranchOutcome = 'rebased' | 'rewriting' | 'stopped' | 'busy';

export type ApplyHistoryRewriteInput = HistoryMountInput & {
  readonly origin: HistoryRunOrigin;
  readonly planId: string | null;
  readonly newHead: string;
  readonly expectedHead: string;
  readonly map: ReadonlyArray<HistoryShaMove>;
  readonly shouldPush: boolean;
  readonly byAgent: boolean;
  readonly identity: HistoryIdentity;
  readonly summary?: string;
  readonly isTreeEqual?: boolean;
  readonly incorporatedRemoteSha?: string | null;
};

export type ApplyHistoryRewriteOutcome = 'applied' | 'pushed' | 'stopped' | 'busy';

export type StartHistoryRewriterInput = HistoryMountInput & {
  readonly plan: HistoryPlanArgs;
  readonly origin: HistoryRunOrigin;
  readonly planId: string | null;
  readonly note?: string;
};

export type SettleHistoryRewriterInput = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly assistantText: string;
  readonly hasFailed: boolean;
};

export type HistoryDraft = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly planId: string | null;
  readonly branch: string;
  readonly baseSha: string;
  readonly headSha: string;
  readonly commits: ReadonlyArray<BranchCommit>;
  readonly items: ReadonlyArray<HistoryStep>;
  readonly onto: string | null;
  readonly graph: HistoryGraph | null;
  readonly undo: ReadonlyArray<HistoryDraftPlan>;
  readonly prediction: HistoryPlanPrediction | null;
  readonly isPredicting: boolean;
  readonly loadError: string | null;
};

export type HistoryDraftPlan = {
  readonly items: ReadonlyArray<HistoryStep>;
  readonly onto: string | null;
};

export type EditHistoryDraftInput = HistoryMountInput & {
  readonly items: ReadonlyArray<HistoryStep>;
  readonly onto?: string | null;
};

export type ApplyHistoryDraftInput = HistoryMountInput & {
  readonly shouldPush: boolean;
};

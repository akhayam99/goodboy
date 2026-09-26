import type {
  AgentId,
  BranchCommit,
  HistoryPlanArgs,
  HistoryPlanPrediction,
  HistoryStep,
  HistoryShaMove,
  MountId,
  ProjectId,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';

import type { HistoryEdit } from '../../../features/history/historyPlan';

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
  'conflict' | 'hook' | 'stuck' | 'invalid' | 'origin-moved' | 'head-moved' | 'blocked' | 'failed';

export type HistoryStop = {
  readonly reason: HistoryStopReason;
  readonly message: string;
  readonly files: ReadonlyArray<string>;
  readonly sha: string | null;
};

export type HistoryRewriteResult = {
  readonly head: string;
  readonly expectedHead: string;
  readonly map: ReadonlyArray<HistoryShaMove>;
  readonly isTreeEqual: boolean;
  readonly changedFiles: ReadonlyArray<string>;
  readonly byAgent: boolean;
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
  readonly updatedAt: number;
};

export type HistoryRewriterBinding = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly copyPath: string;
  readonly plan: HistoryPlanArgs;
  readonly origin: HistoryRunOrigin;
  readonly planId: string | null;
};

export type HistoryTarget = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly workspaceId: WorkspaceId | null;
  readonly worktreePath: string;
  readonly branch: string;
  readonly baseBranch: string;
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
  readonly prediction: HistoryPlanPrediction | null;
  readonly isPredicting: boolean;
  readonly lastEdit: HistoryEdit | null;
  readonly conflictEdit: HistoryEdit | null;
  readonly loadError: string | null;
};

export type EditHistoryDraftInput = HistoryMountInput & {
  readonly items: ReadonlyArray<HistoryStep>;
  readonly edit: HistoryEdit | null;
};

export type ApplyHistoryDraftInput = HistoryMountInput & {
  readonly shouldPush: boolean;
};

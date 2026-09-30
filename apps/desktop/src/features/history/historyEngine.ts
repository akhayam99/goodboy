import { Channel } from '@tauri-apps/api/core';
import { invokeCommand } from '../../shared/lib/invokeCommand';
import type {
  HistoryBackup,
  HistoryGraph,
  HistoryMoveOutcome,
  HistoryOriginAhead,
  HistoryPlanArgs,
  HistoryPlanPrediction,
  HistoryRebasePlan,
  HistoryRemoteLease,
  HistoryRewriterCheck,
  HistoryRunOutcome,
  HistoryTrialProgress,
  HistoryTrialResult,
  LeasePushOutcome,
} from '@goodboy/types';

type MoveBranchParams = {
  readonly worktreePath: string;
  readonly branch: string;
  readonly expectedHead: string;
  readonly newHead: string;
};

type RestoreParams = {
  readonly worktreePath: string;
  readonly branch: string;
  readonly expectedHead: string;
  readonly backupRef: string;
};

type BackupsParams = {
  readonly worktreePath: string;
  readonly branch: string;
};

type LeasePushParams = {
  readonly worktreePath: string;
  readonly branch: string;
  readonly expectedRemoteSha: string | null;
  readonly workspaceId: string | null;
  readonly projectId: string | null;
};

const toArgs = (plan: HistoryPlanArgs) => ({
  worktreePath: plan.worktreePath,
  base: plan.base,
  head: plan.head,
  steps: plan.steps.map((step) => ({
    sha: step.sha,
    verb: step.verb,
    message: step.message ?? null,
    target: step.target ?? null,
  })),
  onto: plan.onto ?? null,
});

export const predictHistoryPlan = async (plan: HistoryPlanArgs): Promise<HistoryPlanPrediction> =>
  invokeCommand<HistoryPlanPrediction>('history_plan_predict', { args: toArgs(plan) });

export const tryHistoryPlan = async (plan: HistoryPlanArgs): Promise<HistoryTrialResult> =>
  invokeCommand<HistoryTrialResult>('history_plan_try', { args: toArgs(plan) });

type RunPlanParams = {
  readonly plan: HistoryPlanArgs;
  readonly branch: string;
  readonly onProgress: (progress: HistoryTrialProgress) => void;
};

export const runHistoryPlan = async ({
  plan,
  branch,
  onProgress,
}: RunPlanParams): Promise<HistoryRunOutcome> => {
  const channel = new Channel<HistoryTrialProgress>();
  channel.onmessage = onProgress;
  return invokeCommand<HistoryRunOutcome>('history_plan_run', {
    args: { plan: toArgs(plan), branch },
    onProgress: channel,
  });
};

type GraphParams = {
  readonly worktreePath: string;
  readonly baseBranch: string | null;
  readonly branch: string;
};

export const readHistoryGraph = async ({
  worktreePath,
  baseBranch,
  branch,
}: GraphParams): Promise<HistoryGraph> =>
  invokeCommand<HistoryGraph>('history_graph', { worktreePath, baseBranch, branch });

export const applyHistoryPlan = async (params: MoveBranchParams): Promise<HistoryMoveOutcome> =>
  invokeCommand<HistoryMoveOutcome>('history_plan_apply', { args: params });

export const restoreHistoryBackup = async (params: RestoreParams): Promise<HistoryMoveOutcome> =>
  invokeCommand<HistoryMoveOutcome>('history_restore', { args: params });

export const listHistoryBackups = async ({
  worktreePath,
  branch,
}: BackupsParams): Promise<ReadonlyArray<HistoryBackup>> =>
  invokeCommand<ReadonlyArray<HistoryBackup>>('history_backups_list', { worktreePath, branch });

export const isHistoryPredictionSupported = async (): Promise<boolean> =>
  invokeCommand<boolean>('history_git_supported').catch(() => false);

export const pushWithLease = async ({
  worktreePath,
  branch,
  expectedRemoteSha,
  workspaceId,
  projectId,
}: LeasePushParams): Promise<LeasePushOutcome> =>
  invokeCommand<LeasePushOutcome>('git_push_with_lease', {
    cwd: worktreePath,
    branch,
    expectedRemoteSha,
    workspaceId,
    projectId,
  });

type RemoteLeaseParams = {
  readonly worktreePath: string;
  readonly branch: string;
  readonly expectedHead: string;
  readonly incorporated: string | null;
  readonly incorporatedSince: string | null;
  readonly workspaceId: string | null;
  readonly projectId: string | null;
};

export const readRemoteLease = async ({
  worktreePath,
  branch,
  expectedHead,
  incorporated,
  incorporatedSince,
  workspaceId,
  projectId,
}: RemoteLeaseParams): Promise<HistoryRemoteLease> =>
  invokeCommand<HistoryRemoteLease>('history_remote_lease', {
    worktreePath,
    branch,
    expectedHead,
    incorporated,
    incorporatedSince,
    workspaceId,
    projectId,
  });

type RebasePlanParams = {
  readonly worktreePath: string;
  readonly baseBranch: string | null;
  readonly fetches: boolean;
};

export const readRebasePlan = async ({
  worktreePath,
  baseBranch,
  fetches,
}: RebasePlanParams): Promise<HistoryRebasePlan> =>
  invokeCommand<HistoryRebasePlan>('history_rebase_plan', { worktreePath, baseBranch, fetches });

type PrepareRewriteParams = {
  readonly plan: HistoryPlanArgs;
  readonly slug: string;
};

export const prepareHistoryRewrite = async ({
  plan,
  slug,
}: PrepareRewriteParams): Promise<HistoryTrialResult> =>
  invokeCommand<HistoryTrialResult>('history_rewriter_prepare', {
    args: { plan: toArgs(plan), slug },
  });

type CollectRewriteParams = {
  readonly plan: HistoryPlanArgs;
  readonly copyPath: string;
  readonly skipped: ReadonlyArray<string>;
  readonly keepsCopy: boolean;
};

export const collectHistoryRewrite = async ({
  plan,
  copyPath,
  skipped,
  keepsCopy,
}: CollectRewriteParams): Promise<HistoryRewriterCheck> =>
  invokeCommand<HistoryRewriterCheck>('history_rewriter_collect', {
    args: { plan: toArgs(plan), copyPath, skipped, keepsCopy },
  });

export type HistoryCopyGitDirs = {
  readonly gitDir: string;
  readonly objectsDir: string;
  readonly packedRefsLock: string;
};

export const readHistoryCopyGitDirs = async ({
  copyPath,
}: {
  readonly copyPath: string;
}): Promise<HistoryCopyGitDirs | null> =>
  invokeCommand<HistoryCopyGitDirs | null>('history_copy_git_dirs', { copyPath });

type DiscardCopyParams = {
  readonly worktreePath: string;
  readonly copyPath: string;
};

export const discardHistoryCopy = async ({
  worktreePath,
  copyPath,
}: DiscardCopyParams): Promise<void> =>
  invokeCommand<void>('history_copy_discard', { worktreePath, copyPath });

type OriginAheadParams = {
  readonly worktreePath: string;
  readonly branch: string;
  readonly since: string | null;
  readonly workspaceId: string | null;
  readonly projectId: string | null;
};

export const readOriginAhead = async ({
  worktreePath,
  branch,
  since,
  workspaceId,
  projectId,
}: OriginAheadParams): Promise<HistoryOriginAhead> =>
  invokeCommand<HistoryOriginAhead>('history_origin_ahead', {
    worktreePath,
    branch,
    since,
    workspaceId,
    projectId,
  });

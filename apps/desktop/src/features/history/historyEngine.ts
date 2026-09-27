import { invoke } from '@tauri-apps/api/core';
import type {
  HistoryBackup,
  HistoryMoveOutcome,
  HistoryOriginAhead,
  HistoryPlanArgs,
  HistoryPlanPrediction,
  HistoryRebasePlan,
  HistoryRewriterCheck,
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
});

export const predictHistoryPlan = async (plan: HistoryPlanArgs): Promise<HistoryPlanPrediction> =>
  invoke<HistoryPlanPrediction>('history_plan_predict', { args: toArgs(plan) });

export const tryHistoryPlan = async (plan: HistoryPlanArgs): Promise<HistoryTrialResult> =>
  invoke<HistoryTrialResult>('history_plan_try', { args: toArgs(plan) });

export const applyHistoryPlan = async (params: MoveBranchParams): Promise<HistoryMoveOutcome> =>
  invoke<HistoryMoveOutcome>('history_plan_apply', { args: params });

export const restoreHistoryBackup = async (params: RestoreParams): Promise<HistoryMoveOutcome> =>
  invoke<HistoryMoveOutcome>('history_restore', { args: params });

export const listHistoryBackups = async ({
  worktreePath,
  branch,
}: BackupsParams): Promise<ReadonlyArray<HistoryBackup>> =>
  invoke<ReadonlyArray<HistoryBackup>>('history_backups_list', { worktreePath, branch });

export const isHistoryPredictionSupported = async (): Promise<boolean> =>
  invoke<boolean>('history_git_supported').catch(() => false);

export const pushWithLease = async ({
  worktreePath,
  branch,
  expectedRemoteSha,
  workspaceId,
  projectId,
}: LeasePushParams): Promise<LeasePushOutcome> =>
  invoke<LeasePushOutcome>('git_push_with_lease', {
    cwd: worktreePath,
    branch,
    expectedRemoteSha,
    workspaceId,
    projectId,
  });

type RebasePlanParams = {
  readonly worktreePath: string;
  readonly baseBranch: string;
  readonly fetches: boolean;
};

export const readRebasePlan = async ({
  worktreePath,
  baseBranch,
  fetches,
}: RebasePlanParams): Promise<HistoryRebasePlan> =>
  invoke<HistoryRebasePlan>('history_rebase_plan', { worktreePath, baseBranch, fetches });

type PrepareRewriteParams = {
  readonly plan: HistoryPlanArgs;
  readonly slug: string;
};

export const prepareHistoryRewrite = async ({
  plan,
  slug,
}: PrepareRewriteParams): Promise<HistoryTrialResult> =>
  invoke<HistoryTrialResult>('history_rewriter_prepare', { args: { plan: toArgs(plan), slug } });

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
  invoke<HistoryRewriterCheck>('history_rewriter_collect', {
    args: { plan: toArgs(plan), copyPath, skipped, keepsCopy },
  });

type DiscardCopyParams = {
  readonly worktreePath: string;
  readonly copyPath: string;
};

export const discardHistoryCopy = async ({
  worktreePath,
  copyPath,
}: DiscardCopyParams): Promise<void> =>
  invoke<void>('history_copy_discard', { worktreePath, copyPath });

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
  invoke<HistoryOriginAhead>('history_origin_ahead', {
    worktreePath,
    branch,
    since,
    workspaceId,
    projectId,
  });

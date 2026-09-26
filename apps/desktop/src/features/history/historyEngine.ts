import { invoke } from '@tauri-apps/api/core';
import type {
  HistoryBackup,
  HistoryMoveOutcome,
  HistoryPlanArgs,
  HistoryPlanPrediction,
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

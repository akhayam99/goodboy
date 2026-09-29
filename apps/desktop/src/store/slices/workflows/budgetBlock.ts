import type { BudgetAlert, SessionBudget, SessionId, WorkflowRun } from '@goodboy/types';
import { formatUsd } from '@goodboy/ui';
import { runSpendUsd } from './runSpendUsd';
import type { GetFn } from './types';

type Params = {
  readonly alerts: ReadonlyArray<BudgetAlert>;
  readonly budgets: Readonly<Record<SessionId, SessionBudget>>;
  readonly sessionId: SessionId;
};

const NO_BUDGETS: Readonly<Record<SessionId, SessionBudget>> = {};

type MessageParams = {
  readonly limitUsd: number;
};

export const budgetBlockMessage = ({ limitUsd }: MessageParams): string =>
  `Paused at the ${formatUsd(limitUsd)} spend limit for this session.`;

const sessionBudgetBlock = ({ alerts, budgets, sessionId }: Params): BudgetAlert | null => {
  if (budgets[sessionId]?.onExceed === 'warn') {
    return null;
  }
  return (
    alerts.find(
      (alert) =>
        alert.dismissedAt === undefined &&
        alert.kind === 'session-exceeded' &&
        alert.sessionId === sessionId,
    ) ?? null
  );
};

export const isBudgetBlocked = (params: Params): boolean => sessionBudgetBlock(params) !== null;

type EnsureParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
};

export const sessionBudgetBlockAfterLoad = async ({
  get,
  sessionId,
}: EnsureParams): Promise<BudgetAlert | null> => {
  const before = get();
  const budgets = before.sessionBudgets ?? NO_BUDGETS;
  const pending = sessionBudgetBlock({ alerts: before.budgetAlerts ?? [], budgets, sessionId });
  if (pending === null || budgets[sessionId] !== undefined) {
    return pending;
  }
  await get()
    .loadSessionBudget(sessionId)
    .catch(() => undefined);
  const after = get();
  return sessionBudgetBlock({
    alerts: after.budgetAlerts ?? [],
    budgets: after.sessionBudgets ?? NO_BUDGETS,
    sessionId,
  });
};

export type SpendLimitStop = {
  readonly kind: 'notify' | 'pause';
  readonly limitUsd: number;
  readonly message: string;
};

const spendLimitMessage = (limitUsd: number, kind: 'notify' | 'pause'): string =>
  kind === 'pause'
    ? `Paused at the ${formatUsd(limitUsd)} spend limit for this run.`
    : `this run passed its spend limit of ${formatUsd(limitUsd)} and keeps going`;

type SpendLimitParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
};

type TelemetryParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly runs: ReadonlyArray<WorkflowRun>;
};

export const loadSpendLimitTelemetry = async ({
  get,
  sessionId,
  runs,
}: TelemetryParams): Promise<void> => {
  if (runs.every((run) => run.spendLimitUsd == null)) {
    return;
  }
  await get().loadSessionTelemetry(sessionId);
};

export const spentUsdForRun = ({ get, sessionId, run }: SpendLimitParams): number => {
  const state = get();
  return runSpendUsd({
    records: state.sessionTelemetry[sessionId] ?? [],
    agents: state.sessionPhaseRuns[sessionId] ?? [],
    agentRunHistory: state.agentRunHistory,
    workflowRunId: run.id,
  });
};

export const resolveSpendLimitStop = ({
  get,
  sessionId,
  run,
}: SpendLimitParams): SpendLimitStop | null => {
  const limitUsd = run.spendLimitUsd;
  if (limitUsd == null) {
    return null;
  }
  if (spentUsdForRun({ get, sessionId, run }) < limitUsd) {
    return null;
  }
  const kind = run.spendLimitMode ?? 'pause';
  return { kind, limitUsd, message: spendLimitMessage(limitUsd, kind) };
};

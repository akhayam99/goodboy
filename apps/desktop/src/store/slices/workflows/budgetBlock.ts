import type { BudgetAlert, SessionId, WorkflowRun } from '@goodboy/types';
import { formatUsd } from '@goodboy/ui';
import { runSpendUsd } from './runSpendUsd';
import type { GetFn } from './types';

type Params = {
  readonly alerts: ReadonlyArray<BudgetAlert>;
  readonly sessionId: SessionId;
};

export const BUDGET_BLOCK_MESSAGE =
  'the budget cap is reached, raise it in Budget to keep this run going';

export const isBudgetBlocked = ({ alerts, sessionId }: Params): boolean => {
  return alerts.some(
    (alert) =>
      alert.dismissedAt === undefined &&
      ((alert.kind === 'session-exceeded' && alert.sessionId === sessionId) ||
        alert.kind === 'provider-exceeded'),
  );
};

export type SpendLimitStop = {
  readonly kind: 'notify' | 'pause';
  readonly limitUsd: number;
  readonly message: string;
};

const spendLimitMessage = (limitUsd: number, kind: 'notify' | 'pause'): string =>
  kind === 'pause'
    ? `the spend limit of ${formatUsd(limitUsd)} for this run is reached, raise it to keep going`
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

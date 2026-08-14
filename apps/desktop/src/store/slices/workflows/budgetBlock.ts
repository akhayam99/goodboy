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

export const resolveSpendLimitStop = async ({
  get,
  sessionId,
  run,
}: SpendLimitParams): Promise<SpendLimitStop | null> => {
  const limitUsd = run.spendLimitUsd;
  if (limitUsd == null) {
    return null;
  }
  await get().loadSessionTelemetry(sessionId);
  const state = get();
  const spentUsd = runSpendUsd({
    records: state.sessionTelemetry[sessionId] ?? [],
    agents: state.sessionPhaseRuns[sessionId] ?? [],
    agentRunHistory: state.agentRunHistory,
    workflowRunId: run.id,
  });
  if (spentUsd < limitUsd) {
    return null;
  }
  const kind = run.spendLimitMode ?? 'pause';
  return { kind, limitUsd, message: spendLimitMessage(limitUsd, kind) };
};

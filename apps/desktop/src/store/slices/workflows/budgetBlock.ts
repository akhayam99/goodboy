import type { BudgetAlert, SessionId } from '@goodboy/types';

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

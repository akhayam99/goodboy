import type { BudgetRule, SessionBudget, WorkflowRun } from '@goodboy/types';

type Params = {
  readonly run: WorkflowRun | null;
  readonly sessionBudget: SessionBudget | null;
  readonly budgetRules: ReadonlyArray<BudgetRule>;
};

type AmountParams = {
  readonly usd: number | null | undefined;
};

const isLimitAmount = ({ usd }: AmountParams): boolean =>
  usd != null && Number.isFinite(usd) && usd > 0;

export const isWorkflowRunLimited = ({ run, sessionBudget, budgetRules }: Params): boolean => {
  if (
    run !== null &&
    isLimitAmount({ usd: run.spendLimitUsd }) &&
    (run.spendLimitMode ?? 'pause') === 'pause'
  ) {
    return true;
  }
  if (
    sessionBudget !== null &&
    sessionBudget.onExceed === 'pause' &&
    isLimitAmount({ usd: sessionBudget.softCapUsd })
  ) {
    return true;
  }
  return budgetRules.some((rule) => isLimitAmount({ usd: rule.capUsd }));
};

import type { BudgetRule, ProviderName, SessionBudget, WorkflowRun } from '@goodboy/types';

type Params = {
  readonly run: WorkflowRun | null;
  readonly sessionBudget: SessionBudget | null;
  readonly budgetRules: ReadonlyArray<BudgetRule>;
  readonly providers: ReadonlyArray<ProviderName>;
};

type AmountParams = {
  readonly usd: number | null | undefined;
};

const isLimitAmount = ({ usd }: AmountParams): boolean =>
  usd != null && Number.isFinite(usd) && usd > 0;

export const isWorkflowRunLimited = ({
  run,
  sessionBudget,
  budgetRules,
  providers,
}: Params): boolean => {
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
  return (
    providers.length > 0 &&
    providers.every((provider) =>
      budgetRules.some((rule) => rule.provider === provider && isLimitAmount({ usd: rule.capUsd })),
    )
  );
};

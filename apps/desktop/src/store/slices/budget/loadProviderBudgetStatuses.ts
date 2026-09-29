import type { BudgetRule } from '@goodboy/types';
import { invokeBudgetRuleList, invokeCheckProviderBudget } from '../../../features/budget/budget';
import type { ProviderBudgetStatuses } from './types';

type Params = {
  readonly rules: ReadonlyArray<BudgetRule>;
};

export const loadProviderBudgetStatuses = async ({
  rules,
}: Params): Promise<ProviderBudgetStatuses> => {
  const entries = await Promise.all(
    rules.map(async (rule) => {
      try {
        const status = await invokeCheckProviderBudget(rule.provider, rule.period);
        return status === undefined || status === null ? null : ([rule.provider, status] as const);
      } catch {
        return null;
      }
    }),
  );
  return Object.fromEntries(entries.filter((entry) => entry !== null));
};

export const loadCurrentProviderBudgetStatuses = async (): Promise<ProviderBudgetStatuses> => {
  try {
    return await loadProviderBudgetStatuses({ rules: await invokeBudgetRuleList() });
  } catch {
    return {};
  }
};

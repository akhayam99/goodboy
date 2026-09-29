import type { ProviderBudgetStatuses } from './types';

export type BudgetSliceState = {
  readonly providerBudgetStatus: ProviderBudgetStatuses;
};

export const budgetInitialState: BudgetSliceState = {
  providerBudgetStatus: {},
};

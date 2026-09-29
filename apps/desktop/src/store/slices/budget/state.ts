import type { BudgetRule, SessionId, SessionBudget, BudgetAlert } from '@goodboy/types';

import type { ProviderBudgetStatuses, ProviderSpendEntry } from './types';

export type BudgetSliceState = {
  readonly providerBudgetStatus: ProviderBudgetStatuses;

  readonly budgetRules: ReadonlyArray<BudgetRule>;
  readonly sessionBudgets: Readonly<Record<SessionId, SessionBudget>>;
  readonly providerSpendBreakdown: ReadonlyArray<ProviderSpendEntry>;
  readonly budgetAlerts: ReadonlyArray<BudgetAlert>;
};

export const budgetInitialState: BudgetSliceState = {
  providerBudgetStatus: {},

  budgetRules: [],
  sessionBudgets: {},
  providerSpendBreakdown: [],
  budgetAlerts: [],
};

import { buildProviderSpendBreakdown } from './buildProviderSpendBreakdown';
import { deleteBudgetRule } from './deleteBudgetRule';
import { dismissBudgetAlert } from './dismissBudgetAlert';
import { loadBudgetAlerts } from './loadBudgetAlerts';
import { loadBudgetRules } from './loadBudgetRules';
import { loadSessionBudget } from './loadSessionBudget';
import { refreshProviderSpendBreakdown } from './refreshProviderSpendBreakdown';
import { saveBudgetRule } from './saveBudgetRule';
import { setSessionBudget } from './setSessionBudget';
import type { GetFn, SetFn } from './types';

export { buildProviderSpendBreakdown };
export type { ProviderSpendEntry } from './types';

export const createBudgetSlice = (set: SetFn, _get: GetFn) => {
  return {
    loadBudgetRules: loadBudgetRules(set),
    saveBudgetRule: saveBudgetRule(set),
    deleteBudgetRule: deleteBudgetRule(set),
    loadSessionBudget: loadSessionBudget(set),
    setSessionBudget: setSessionBudget(set),
    refreshProviderSpendBreakdown: refreshProviderSpendBreakdown(set),
    loadBudgetAlerts: loadBudgetAlerts(set),
    dismissBudgetAlert: dismissBudgetAlert(set),
  };
};

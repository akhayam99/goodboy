import { buildProviderSpendBreakdown } from './buildProviderSpendBreakdown';
import { deleteBudgetRule } from './deleteBudgetRule';
import { dismissBudgetAlert } from './dismissBudgetAlert';
import { loadBudgetAlerts } from './loadBudgetAlerts';
import { loadBudgetRules } from './loadBudgetRules';
import { loadCurrentProviderBudgetStatuses } from './loadProviderBudgetStatuses';
import { loadSessionBudget } from './loadSessionBudget';
import { refreshProviderBudgetStatus } from './refreshProviderBudgetStatus';
import { refreshProviderSpendBreakdown } from './refreshProviderSpendBreakdown';
import { saveBudgetRule } from './saveBudgetRule';
import { setSessionBudget } from './setSessionBudget';
import { clearSessionBudget } from './clearSessionBudget';
import type { GetFn, SetFn } from './types';

export { buildProviderSpendBreakdown, loadCurrentProviderBudgetStatuses };
export type { ProviderBudgetStatuses, ProviderSpendEntry } from './types';

export const createBudgetSlice = (set: SetFn, _get: GetFn) => {
  return {
    loadBudgetRules: loadBudgetRules(set),
    saveBudgetRule: saveBudgetRule(set),
    deleteBudgetRule: deleteBudgetRule(set),
    loadSessionBudget: loadSessionBudget(set),
    setSessionBudget: setSessionBudget(set),
    clearSessionBudget: clearSessionBudget(set),
    refreshProviderSpendBreakdown: refreshProviderSpendBreakdown(set),
    refreshProviderBudgetStatus: refreshProviderBudgetStatus(set),
    loadBudgetAlerts: loadBudgetAlerts(set),
    dismissBudgetAlert: dismissBudgetAlert(set),
  };
};

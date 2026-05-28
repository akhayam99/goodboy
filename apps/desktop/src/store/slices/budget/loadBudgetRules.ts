import { invokeBudgetRuleList } from '../../../features/budget/budget';
import type { SetFn } from './types';

export function loadBudgetRules(set: SetFn) {
  return async () => {
    const rules = await invokeBudgetRuleList();
    set({ budgetRules: rules });
  };
}

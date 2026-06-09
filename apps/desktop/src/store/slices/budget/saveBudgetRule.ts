import type { BudgetRule, IsoDateTime } from '@goodboy/types';
import { invokeBudgetRuleList, invokeBudgetRuleUpsert } from '../../../features/budget/budget';
import type { SetFn } from './types';

export const saveBudgetRule = (set: SetFn) => {
  return async (partial: Omit<BudgetRule, 'id' | 'createdAt'>) => {
    const now = new Date().toISOString() as IsoDateTime;
    const rule: BudgetRule = {
      id: crypto.randomUUID(),
      createdAt: now,
      ...partial,
    };
    await invokeBudgetRuleUpsert(rule);
    const rules = await invokeBudgetRuleList();
    set({ budgetRules: rules });
  };
};

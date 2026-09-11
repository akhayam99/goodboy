import type { BudgetRule, IsoDateTime } from '@goodboy/types';
import { invokeBudgetRuleList, invokeBudgetRuleUpsert } from '../../../features/budget/budget';
import type { SetFn } from './types';

type SaveBudgetRuleInput = BudgetRule | Omit<BudgetRule, 'id' | 'createdAt'>;

export const saveBudgetRule = (set: SetFn) => {
  return async (input: SaveBudgetRuleInput) => {
    const rule: BudgetRule =
      'id' in input
        ? input
        : {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString() as IsoDateTime,
            ...input,
          };
    await invokeBudgetRuleUpsert(rule);
    const rules = await invokeBudgetRuleList();
    set({ budgetRules: rules });
  };
};

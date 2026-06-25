import { invokeBudgetRuleDelete } from '../../../features/budget/budget'
import type { SetFn } from './types'

export const deleteBudgetRule = (set: SetFn) => {
  return async (id: string) => {
    await invokeBudgetRuleDelete(id)
    set((state) => ({ budgetRules: state.budgetRules.filter((r) => r.id !== id) }))
  }
}

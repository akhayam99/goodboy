import { invokeBudgetAlertsList } from '../../../features/budget/budget'
import type { SetFn } from './types'

export const loadBudgetAlerts = (set: SetFn) => {
  return async () => {
    const alerts = await invokeBudgetAlertsList()
    set({ budgetAlerts: alerts })
  }
}

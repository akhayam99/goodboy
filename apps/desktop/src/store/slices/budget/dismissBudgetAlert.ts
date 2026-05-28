import type { IsoDateTime } from '@goodboy/types';
import { invokeBudgetAlertDismiss } from '../../../features/budget/budget';
import type { SetFn } from './types';

export function dismissBudgetAlert(set: SetFn) {
  return async (id: string) => {
    await invokeBudgetAlertDismiss(id);
    set((state) => ({
      budgetAlerts: state.budgetAlerts.map((a) =>
        a.id === id ? { ...a, dismissedAt: new Date().toISOString() as IsoDateTime } : a,
      ),
    }));
  };
}

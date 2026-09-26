import type { SessionId } from '@goodboy/types';
import { invokeSessionBudgetClear } from '../../../features/budget/budget';
import type { SetFn } from './types';

export const clearSessionBudget = (set: SetFn) => {
  return async (sessionId: SessionId) => {
    await invokeSessionBudgetClear(sessionId);
    set((state) => {
      const sessionBudgets = { ...state.sessionBudgets };
      delete sessionBudgets[sessionId];
      return {
        sessionBudgets,
        budgetAlerts: state.budgetAlerts.filter((alert) => alert.sessionId !== sessionId),
      };
    });
  };
};

import type { SessionId } from '@goodboy/types';
import { invokeSessionBudgetGet } from '../../../features/budget/budget';
import type { SetFn } from './types';

export const loadSessionBudget = (set: SetFn) => {
  return async (sessionId: SessionId) => {
    const budget = await invokeSessionBudgetGet(sessionId);
    if (budget !== null) {
      set((state) => ({
        sessionBudgets: { ...state.sessionBudgets, [sessionId]: budget },
      }));
    }
  };
};

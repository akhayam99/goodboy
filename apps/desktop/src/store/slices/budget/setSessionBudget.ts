import type { SessionBudget, SessionId } from '@goodboy/types';
import { invokeSessionBudgetSet } from '../../../features/budget/budget';
import type { SetFn } from './types';

export const setSessionBudget = (set: SetFn) => {
  return async (sessionId: SessionId, softCapUsd: number) => {
    await invokeSessionBudgetSet(sessionId, softCapUsd);
    const budget: SessionBudget = { sessionId, softCapUsd };
    set((state) => ({
      sessionBudgets: { ...state.sessionBudgets, [sessionId]: budget },
    }));
  };
};

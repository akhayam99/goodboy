import type { SessionBudget, SessionBudgetOnExceed, SessionId } from '@goodboy/types';
import { invokeSessionBudgetSet } from '../../../features/budget/budget';
import type { SetFn } from './types';

export const setSessionBudget = (set: SetFn) => {
  return async (
    sessionId: SessionId,
    softCapUsd: number,
    onExceed: SessionBudgetOnExceed = 'pause',
  ) => {
    await invokeSessionBudgetSet(sessionId, softCapUsd, onExceed);
    const budget: SessionBudget = { sessionId, softCapUsd, onExceed };
    set((state) => ({
      sessionBudgets: { ...state.sessionBudgets, [sessionId]: budget },
    }));
  };
};

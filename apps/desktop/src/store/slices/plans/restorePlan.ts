import type { PlanId, SessionId } from '@goodboy/types';
import {
  listPlansForSession as invokeListPlansForSession,
  setPlanStatus as invokeSetPlanStatus,
} from '../../../features/plans/plans';
import type { SetFn } from './types';

export const restorePlan = (set: SetFn) => {
  return async (sessionId: SessionId, planId: PlanId) => {
    await invokeSetPlanStatus(planId, 'active');
    const refreshed = await invokeListPlansForSession(sessionId);
    set((state) => ({
      sessionPlans: { ...state.sessionPlans, [sessionId]: refreshed },
    }));
  };
};

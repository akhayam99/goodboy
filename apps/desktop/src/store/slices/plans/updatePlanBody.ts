import type { PlanId, SessionId } from '@goodboy/types';
import {
  listPlansForSession as invokeListPlansForSession,
  setPlanBody as invokeSetPlanBody,
} from '../../../features/plans/plans';
import type { SetFn } from './types';

export const updatePlanBody = (set: SetFn) => {
  return async (sessionId: SessionId, planId: PlanId, title: string, bodyMd: string) => {
    await invokeSetPlanBody(planId, title, bodyMd);
    const refreshed = await invokeListPlansForSession(sessionId);
    set((state) => ({
      sessionPlans: { ...state.sessionPlans, [sessionId]: refreshed },
    }));
  };
};

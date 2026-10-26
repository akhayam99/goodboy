import type { PlanId, PlanStatus, SessionId } from '@goodboy/types';
import {
  listPlansForSession as invokeListPlansForSession,
  setPlanStatus as invokeSetPlanStatus,
} from '../../../features/plans/plans';
import { sessionReads } from '../../runtime/state-writes/sessionReads';
import type { SetFn } from './types';

export const setPlanStatus = (set: SetFn) => {
  return async (sessionId: SessionId, planId: PlanId, status: PlanStatus) => {
    await invokeSetPlanStatus(planId, status);
    const plansRead = sessionReads.plans({ sessionId });
    const refreshed = await invokeListPlansForSession(sessionId);
    set((state) =>
      plansRead.isCurrent()
        ? { sessionPlans: { ...state.sessionPlans, [sessionId]: refreshed } }
        : {},
    );
  };
};

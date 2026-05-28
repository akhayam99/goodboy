import type { PlanId, SessionId } from '@goodboy/types';
import {
  listPlansForSession as invokeListPlansForSession,
  setPlanStatus as invokeSetPlanStatus,
} from '../../../features/plans/plans';
import type { SetFn } from './types';

// Soft delete: status flips to 'discarded'. The row stays in the DB so
// the user can restore it with a second click. Hard deletion lives at
// the DB query layer for admin use only.
export function deletePlan(set: SetFn) {
  return async (sessionId: SessionId, planId: PlanId) => {
    await invokeSetPlanStatus(planId, 'discarded');
    const refreshed = await invokeListPlansForSession(sessionId);
    set((state) => ({
      sessionPlans: { ...state.sessionPlans, [sessionId]: refreshed },
    }));
  };
}

import type { PlanId, PlanStatus, SessionId } from '@goodboy/types'
import {
  listPlansForSession as invokeListPlansForSession,
  setPlanStatus as invokeSetPlanStatus,
} from '../../../features/plans/plans'
import type { SetFn } from './types'

export const setPlanStatus = (set: SetFn) => {
  return async (sessionId: SessionId, planId: PlanId, status: PlanStatus) => {
    await invokeSetPlanStatus(planId, status)
    const refreshed = await invokeListPlansForSession(sessionId)
    set((state) => ({
      sessionPlans: { ...state.sessionPlans, [sessionId]: refreshed },
    }))
  }
}

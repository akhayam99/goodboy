import type { PlanId } from '@goodboy/types'
import { listConsumptionsForPlan as invokeListConsumptionsForPlan } from '../../../features/plans/plans'
import type { SetFn } from './types'

export const loadConsumptionsForPlan = (set: SetFn) => {
  return async (planId: PlanId) => {
    const items = await invokeListConsumptionsForPlan(planId)
    set((state) => ({
      planConsumptions: { ...state.planConsumptions, [planId]: items },
    }))
  }
}

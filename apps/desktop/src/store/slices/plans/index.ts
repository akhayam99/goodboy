import { deletePlan } from './deletePlan';
import { loadConsumptionsForPlan } from './loadConsumptionsForPlan';
import { loadSessionPlans } from './loadSessionPlans';
import { restorePlan } from './restorePlan';
import { runPlan } from './runPlan';
import { setPlanStatus } from './setPlanStatus';
import { updatePlanBody } from './updatePlanBody';
import type { GetFn, SetFn } from './types';

export function createPlansSlice(set: SetFn, get: GetFn) {
  return {
    loadSessionPlans: loadSessionPlans(set),
    setPlanStatus: setPlanStatus(set),
    updatePlanBody: updatePlanBody(set),
    deletePlan: deletePlan(set),
    restorePlan: restorePlan(set),
    loadConsumptionsForPlan: loadConsumptionsForPlan(set),
    runPlan: runPlan(get),
  };
}

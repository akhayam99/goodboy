import { deletePlan } from './deletePlan';
import { loadConsumptionsForPlan } from './loadConsumptionsForPlan';
import { loadSessionPlans } from './loadSessionPlans';
import { restorePlan } from './restorePlan';
import { runPlan } from './runPlan';
import { setPlanStatus } from './setPlanStatus';
import { updatePlanBody } from './updatePlanBody';
import type { SliceDeps } from '../../slice-types';

export const createPlansSlice = ({ set, get }: SliceDeps) => {
  return {
    loadSessionPlans: loadSessionPlans(set),
    setPlanStatus: setPlanStatus(set),
    updatePlanBody: updatePlanBody(set),
    deletePlan: deletePlan(set),
    restorePlan: restorePlan(set),
    loadConsumptionsForPlan: loadConsumptionsForPlan(set),
    runPlan: runPlan(get),
  };
};

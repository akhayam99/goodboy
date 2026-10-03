import { loadConsumptionsForPlan } from './loadConsumptionsForPlan';
import { loadSessionPlans } from './loadSessionPlans';
import { runPlan } from './runPlan';
import { setPlanStatus } from './setPlanStatus';
import { updatePlanBody } from './updatePlanBody';
import type { SliceDeps } from '../../slice-types';

export const createPlansSlice = ({ set, get }: SliceDeps) => {
  return {
    loadSessionPlans: loadSessionPlans(set),
    setPlanStatus: setPlanStatus(set),
    updatePlanBody: updatePlanBody(set),
    loadConsumptionsForPlan: loadConsumptionsForPlan(set),
    runPlan: runPlan(get),
  };
};

import type { PlanWithCount, WorkflowRun } from '@goodboy/types';
import { isRunHeldForPlan } from '../../store/slices/workflows/workflowPlanApproval';

export type PlanHandoff = 'none' | 'approved-waiting';

type Params = Readonly<{
  plan: Pick<PlanWithCount, 'status' | 'consumptionCount'>;
  run: Pick<WorkflowRun, 'orchestrationStop' | 'rulesSnapshot'> | null;
}>;

export const planHandoffOf = ({ plan, run }: Params): PlanHandoff => {
  if (run === null || plan.status !== 'active' || plan.consumptionCount > 0) {
    return 'none';
  }
  if (isRunHeldForPlan({ run }) || run.rulesSnapshot?.planApproved !== true) {
    return 'none';
  }
  return 'approved-waiting';
};

import type { PlanWithCount, WorkflowRun } from '@goodboy/types';

export type PlanHandoff = 'none' | 'approved-waiting';

type Params = Readonly<{
  plan: Pick<PlanWithCount, 'status' | 'consumptionCount'>;
  run: Pick<WorkflowRun, 'orchestrationStop' | 'rulesSnapshot'> | null;
}>;

export const planHandoffOf = ({ plan, run }: Params): PlanHandoff => {
  if (run === null || plan.status !== 'active' || plan.consumptionCount > 0) {
    return 'none';
  }
  if (run.orchestrationStop !== undefined || run.rulesSnapshot?.planApproved !== true) {
    return 'none';
  }
  return 'approved-waiting';
};

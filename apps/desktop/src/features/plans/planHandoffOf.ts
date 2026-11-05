import type { PlanWithCount, WorkflowRun } from '@goodboy/types';
import type { AutoTreeView } from '../../store/slices/auto-view/state';

export type PlanHandoff = 'none' | 'approved-waiting' | 'auto-approved';

type Params = Readonly<{
  plan: Pick<PlanWithCount, 'id' | 'status' | 'consumptionCount'>;
  run: Pick<WorkflowRun, 'orchestrationStop' | 'rulesSnapshot'> | null;
  views?: ReadonlyArray<AutoTreeView>;
}>;

type ApprovedParams = Readonly<{
  plan: Pick<PlanWithCount, 'id'>;
  views: ReadonlyArray<AutoTreeView>;
}>;

const isApprovedByAuto = ({ plan, views }: ApprovedParams): boolean =>
  views.some((view) =>
    view.artifacts.some(
      (row) =>
        row.artifact.kind === 'plan' &&
        row.artifact.artifactId === plan.id &&
        row.artifact.approvalState === 'approved',
    ),
  );

export const planHandoffOf = ({ plan, run, views = [] }: Params): PlanHandoff => {
  if (plan.status !== 'active' || plan.consumptionCount > 0) {
    return 'none';
  }
  if (isApprovedByAuto({ plan, views })) {
    return 'auto-approved';
  }
  if (run === null) {
    return 'none';
  }
  if (run.orchestrationStop !== undefined || run.rulesSnapshot?.planApproved !== true) {
    return 'none';
  }
  return 'approved-waiting';
};

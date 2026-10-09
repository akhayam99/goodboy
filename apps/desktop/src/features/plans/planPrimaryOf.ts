import { NAMES } from '../../shared/names';
import type { ArtifactComment, PlanWithCount, WorkflowRun } from '@goodboy/types';
import { isRunHeldForPlan } from '../../store/slices/workflows/workflowPlanApproval';
import { PLANNER_QUESTION_REASON } from './plannerQuestions';
import { NOT_REVISING, PLAN_REVISING_REASON, type PlanRevising } from './planRevising';

type PlanPrimaryKind = 'approve' | 'run' | 'disabled' | 'none';

type PlanPrimaryLabel = typeof NAMES.approve | typeof NAMES.runPlan;

export type PlanPrimary = Readonly<{
  kind: PlanPrimaryKind;
  label: PlanPrimaryLabel | null;
  reason: string | null;
  isSecondary: boolean;
}>;

type Params = Readonly<{
  plan: Pick<PlanWithCount, 'status' | 'consumptionCount'>;
  run: Pick<WorkflowRun, 'orchestrationStop' | 'discardedAt' | 'rulesSnapshot'> | null;
  drafts: ReadonlyArray<ArtifactComment>;
  revising?: PlanRevising;
  isRunning?: boolean;
  plannerQuestionCount?: number;
}>;

const NONE: PlanPrimary = { kind: 'none', label: null, reason: null, isSecondary: false };

export const planPrimaryOf = ({
  plan,
  run,
  drafts,
  revising = NOT_REVISING,
  isRunning = false,
  plannerQuestionCount = 0,
}: Params): PlanPrimary => {
  const feedsRun = run !== null && run.discardedAt == null;
  if (revising.kind === 'revising') {
    return {
      kind: 'disabled',
      label: feedsRun ? NAMES.approve : NAMES.runPlan,
      reason: PLAN_REVISING_REASON,
      isSecondary: false,
    };
  }
  if (plan.status !== 'active' || plan.consumptionCount > 0 || isRunning) {
    return NONE;
  }
  if (plannerQuestionCount > 0) {
    return {
      kind: 'disabled',
      label: feedsRun ? NAMES.approve : NAMES.runPlan,
      reason: PLANNER_QUESTION_REASON,
      isSecondary: false,
    };
  }
  const isSecondary = drafts.length > 0;
  if (!feedsRun) {
    return { kind: 'run', label: NAMES.runPlan, reason: null, isSecondary };
  }
  if (!isRunHeldForPlan({ run }) && run.rulesSnapshot?.planApproved === true) {
    return NONE;
  }
  return { kind: 'approve', label: NAMES.approve, reason: null, isSecondary };
};

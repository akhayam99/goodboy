import type { SessionId, WorkflowRun } from '@goodboy/types';
import { isRunHeldForPlan } from '../../store/slices/workflows/workflowPlanApproval';
import { isRunRevisingPlanIn, type PlanReviewState } from './isRunRevisingPlanIn';

type Params = {
  readonly state: PlanReviewState;
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
};

export const runAwaitsPlanReview = ({ state, sessionId, run }: Params): boolean =>
  isRunHeldForPlan({ run }) && !isRunRevisingPlanIn({ state, sessionId, run });

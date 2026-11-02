import type { SessionId, WorkflowRun } from '@goodboy/types';
import type { AppState } from '../../store/types';
import { isRunRevisingPlan } from './isRunRevisingPlan';
import { revisingByPlanId } from './planRevising';

export type PlanReviewState = Partial<
  Pick<AppState, 'sessionArtifacts' | 'sessionPhaseRuns' | 'agentTurnState'>
>;

type Params = {
  readonly state: PlanReviewState;
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
};

export const isRunRevisingPlanIn = ({ state, sessionId, run }: Params): boolean => {
  const artifacts = state.sessionArtifacts?.[sessionId] ?? [];
  return isRunRevisingPlan({
    run,
    artifacts,
    agents: state.sessionPhaseRuns?.[sessionId] ?? [],
    revising: revisingByPlanId({ artifacts, turnStates: state.agentTurnState ?? {} }),
  });
};

import type { SessionId, WorkflowRun } from '@goodboy/types';
import { isRunRevisingPlanIn, type PlanReviewState } from './isRunRevisingPlanIn';

type Params = {
  readonly state: PlanReviewState;
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
};

export const planRevisingStartIn = ({ state, sessionId, run }: Params): number | null => {
  if (!isRunRevisingPlanIn({ state, sessionId, run })) {
    return null;
  }
  const agentIds = new Set(
    (state.sessionPhaseRuns?.[sessionId] ?? [])
      .filter((agent) => agent.workflowRunId === run.id)
      .map((agent) => agent.id),
  );
  const starts = (state.sessionArtifacts?.[sessionId] ?? [])
    .filter((artifact) => artifact.kind === 'plan' && agentIds.has(artifact.agentId))
    .flatMap((artifact) => {
      const turn = state.agentTurnState?.[artifact.agentId];
      if (turn?.kind === 'running') {
        return [Date.parse(turn.startedAt)];
      }
      if (turn?.kind === 'blocked') {
        return [Date.parse(turn.blockedAt)];
      }
      return [];
    })
    .filter((start) => !Number.isNaN(start));
  return starts.length === 0 ? null : Math.min(...starts);
};

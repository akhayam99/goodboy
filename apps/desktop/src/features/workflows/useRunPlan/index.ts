import { useMemo } from 'react';
import type { Agent, PlanWithCount, SessionId, WorkflowRunId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionPlans } from '../../../store';
import { runPlanOf } from '../runPlanOf';

type Params = {
  readonly sessionId: SessionId;
  readonly runId: WorkflowRunId;
};

export const useRunPlan = ({ sessionId, runId }: Params): PlanWithCount | null => {
  const plans = useSessionPlans(sessionId);
  const agents = useAppStore(
    (state) => state.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  return useMemo(() => runPlanOf({ plans, agents, runId }), [plans, agents, runId]);
};

import { CHECK_STATE } from '../../../store/slices/notifications/errorRecovery';
import { useCallback } from 'react';
import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { useFollowToast } from '../../../shared/hooks/useFollowToast';
import { planApprovedFollowOf } from '../../plans/planApprovedFollow';

type Params = {
  readonly sessionId: SessionId;
  readonly runId: WorkflowRunId;
};

const FALLBACK_STEP_NAME = 'The next step';

export const useApproveRunPlan = ({ sessionId, runId }: Params): (() => Promise<void>) => {
  const approveWorkflowRunPlan = useAppStore((state) => state.approveWorkflowRunPlan);
  const reportError = useAppStore((state) => state.reportError);
  const followToast = useFollowToast();
  return useCallback(async () => {
    const result = await approveWorkflowRunPlan(sessionId, runId);
    if (result.kind === 'noop') {
      return;
    }
    if (result.kind === 'failed') {
      await reportError({
        recovery: CHECK_STATE,
        title: "Couldn't approve the plan",
        error: new Error(result.message),
        sessionId,
      });
      return;
    }
    const startedName =
      result.next === 'started'
        ? ((useAppStore.getState().sessionPhaseRuns[sessionId] ?? []).find(
            (agent) => agent.id === result.agentId,
          )?.name ?? FALLBACK_STEP_NAME)
        : null;
    followToast(planApprovedFollowOf({ sessionId, runId, startedStepName: startedName }));
  }, [approveWorkflowRunPlan, followToast, reportError, runId, sessionId]);
};

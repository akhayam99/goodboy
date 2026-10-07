import { useCallback } from 'react';
import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { sessionPlace, useAppStore } from '../../../store';
import { useFollowToast } from '../../../shared/hooks/useFollowToast';

type Params = {
  readonly sessionId: SessionId;
  readonly runId: WorkflowRunId;
};

const FOLLOW_THE_RUN = 'Follow the run';

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
    followToast({
      title: 'Plan approved',
      message: startedName === null ? 'The run goes on' : `${startedName} started`,
      target: {
        place: sessionPlace({
          sessionId,
          lens: 'workflows',
          target: { kind: 'run', runId },
        }),
      },
      label: FOLLOW_THE_RUN,
      startKey: runId,
    });
  }, [approveWorkflowRunPlan, followToast, reportError, runId, sessionId]);
};

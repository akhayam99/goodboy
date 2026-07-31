import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { updateWorkflowRunOrchestrationOutcome } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { patchWorkflowRun, withoutKeys } from './patchWorkflowRun';
import type { GetFn, SetFn } from './types';

export const retryWorkflowOrchestration = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, workflowRunId: WorkflowRunId): Promise<void> => {
    const session = get().sessions.find((candidate) => candidate.id === sessionId);
    const run = session?.workflowRuns.find((candidate) => candidate.id === workflowRunId);
    if (session == null || run == null || run.executionMode !== 'dynamic') {
      return;
    }
    await updateWorkflowRunOrchestrationOutcome(tauriDatabase, workflowRunId, null);
    patchWorkflowRun({
      set,
      sessionId,
      workflowRunId,
      patch: (current) =>
        withoutKeys(current, ['orchestrationOutcome', 'orchestrationReason', 'orchestrationError']),
    });
    await get().orchestrateNextStep(sessionId, workflowRunId);
  };
};

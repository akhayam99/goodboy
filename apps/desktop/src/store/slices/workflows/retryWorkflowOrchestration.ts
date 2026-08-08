import type { IsoDateTime, SessionId, WorkflowRunId } from '@goodboy/types';
import {
  updateSessionWorkflowAutoRun,
  updateWorkflowRunOrchestrationOutcome,
  updateWorkflowRunOrchestrationStop,
} from '@goodboy/db';
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
    const restoresAutoRun = run.orchestrationStop?.kind === 'operator' && !run.autoRun;
    await updateWorkflowRunOrchestrationOutcome(tauriDatabase, workflowRunId, null);
    await updateWorkflowRunOrchestrationStop(tauriDatabase, workflowRunId, null);
    patchWorkflowRun({
      set,
      sessionId,
      workflowRunId,
      patch: (current) =>
        withoutKeys(current, ['orchestrationOutcome', 'orchestrationReason', 'orchestrationStop']),
    });
    if (restoresAutoRun) {
      const now = new Date().toISOString() as IsoDateTime;
      await updateSessionWorkflowAutoRun(tauriDatabase, sessionId, workflowRunId, true, now);
      patchWorkflowRun({
        set,
        sessionId,
        workflowRunId,
        patch: (current) => ({ ...current, autoRun: true }),
      });
    }
    await get().orchestrateNextStep(sessionId, workflowRunId);
  };
};

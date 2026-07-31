import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { updateWorkflowRunOrchestrationOutcome } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { patchWorkflowRun, withoutKeys } from './patchWorkflowRun';
import type { GetFn, SetFn } from './types';

export const continueWorkflowRun = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, workflowRunId: WorkflowRunId, note?: string) => {
    const session = get().sessions.find((candidate) => candidate.id === sessionId);
    const run = session?.workflowRuns.find((candidate) => candidate.id === workflowRunId);
    if (run == null || run.executionMode !== 'dynamic') {
      return;
    }
    const trimmed = note?.trim() ?? '';
    if (trimmed !== '') {
      const merged = [run.orchestratorHints, trimmed].filter(Boolean).join('\n');
      await get().setWorkflowOrchestratorHints(sessionId, workflowRunId, merged);
    }
    await updateWorkflowRunOrchestrationOutcome(tauriDatabase, workflowRunId, null);
    patchWorkflowRun({
      set,
      sessionId,
      workflowRunId,
      patch: (current) => withoutKeys(current, ['orchestrationOutcome', 'orchestrationError']),
    });
    await get().orchestrateNextStep(sessionId, workflowRunId);
  };
};

import type { OrchestratorRouting, SessionId, WorkflowRunId } from '@goodboy/types';
import { updateWorkflowRunOrchestratorRouting } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { patchWorkflowRun, withoutKeys } from './patchWorkflowRun';
import type { GetFn, SetFn } from './types';

export const setWorkflowOrchestratorRouting = (set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    workflowRunId: WorkflowRunId,
    routing: OrchestratorRouting | null,
  ) => {
    const session = get().sessions.find((candidate) => candidate.id === sessionId);
    const run = session?.workflowRuns.find((candidate) => candidate.id === workflowRunId);
    if (run == null) {
      return;
    }
    await updateWorkflowRunOrchestratorRouting(tauriDatabase, workflowRunId, routing);
    patchWorkflowRun({
      set,
      sessionId,
      workflowRunId,
      patch: (current) =>
        routing == null
          ? withoutKeys(current, ['orchestratorRouting'])
          : { ...current, orchestratorRouting: routing },
    });
  };
};

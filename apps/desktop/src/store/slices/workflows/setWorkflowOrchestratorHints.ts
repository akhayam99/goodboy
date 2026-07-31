import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { updateWorkflowRunOrchestratorHints } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { patchWorkflowRun, withoutKeys } from './patchWorkflowRun';
import type { GetFn, SetFn } from './types';

export const setWorkflowOrchestratorHints = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, workflowRunId: WorkflowRunId, hints: string) => {
    const session = get().sessions.find((candidate) => candidate.id === sessionId);
    const run = session?.workflowRuns.find((candidate) => candidate.id === workflowRunId);
    if (run == null) {
      return;
    }
    const trimmed = hints.trim();
    await updateWorkflowRunOrchestratorHints(tauriDatabase, workflowRunId, trimmed || null);
    patchWorkflowRun({
      set,
      sessionId,
      workflowRunId,
      patch: (current) =>
        trimmed === ''
          ? withoutKeys(current, ['orchestratorHints'])
          : { ...current, orchestratorHints: trimmed },
    });
  };
};

import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { findWorkflowRun } from './findWorkflowRun';
import type { GetFn, SetFn } from './types';
import { writeOrchestratorHints } from './writeOrchestratorHints';

export const removeWorkflowOrchestratorHint = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, workflowRunId: WorkflowRunId, hintId: string) => {
    const run = findWorkflowRun({ get, sessionId, workflowRunId });
    const hints = run?.orchestratorHints ?? [];
    if (hints.some((hint) => hint.id === hintId) === false) {
      return;
    }
    await writeOrchestratorHints({
      set,
      sessionId,
      workflowRunId,
      hints: hints.filter((hint) => hint.id !== hintId),
    });
  };
};

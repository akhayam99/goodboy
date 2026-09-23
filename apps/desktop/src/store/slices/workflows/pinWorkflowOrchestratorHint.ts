import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { findWorkflowRun } from './findWorkflowRun';
import type { GetFn, SetFn } from './types';
import { writeOrchestratorHints } from './writeOrchestratorHints';

export const pinWorkflowOrchestratorHint = (set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    workflowRunId: WorkflowRunId,
    hintId: string,
    isPinned: boolean,
  ) => {
    const run = findWorkflowRun({ get, sessionId, workflowRunId });
    const hints = run?.orchestratorHints ?? [];
    const target = hints.find((hint) => hint.id === hintId);
    if (target == null || target.isPinned === isPinned) {
      return;
    }
    await writeOrchestratorHints({
      set,
      sessionId,
      workflowRunId,
      hints: hints.map((hint) => (hint.id === hintId ? { ...hint, isPinned } : hint)),
    });
  };
};

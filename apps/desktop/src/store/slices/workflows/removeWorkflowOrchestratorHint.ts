import type { SessionId, WorkflowRunId } from '@goodboy/types';
import type { GetFn, SetFn } from './types';
import { updateOrchestratorHints } from './updateOrchestratorHints';

export const removeWorkflowOrchestratorHint = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, workflowRunId: WorkflowRunId, hintId: string) => {
    await updateOrchestratorHints({
      set,
      get,
      sessionId,
      workflowRunId,
      update: (hints) =>
        hints.some((hint) => hint.id === hintId)
          ? hints.filter((hint) => hint.id !== hintId)
          : hints,
    });
  };
};

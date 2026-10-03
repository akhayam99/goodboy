import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { isRunPaused } from '../../../features/workflows/isRunPaused';
import { findWorkflowRun } from './findWorkflowRun';
import { persistOrchestrationStop } from './orchestrateNextStep';
import type { GetFn, SetFn } from './types';

export const resumeWorkflowRun = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, workflowRunId: WorkflowRunId): Promise<void> => {
    const run = findWorkflowRun({ get, sessionId, workflowRunId });
    if (run == null || !isRunPaused({ run })) {
      return;
    }
    await persistOrchestrationStop({ set, sessionId, workflowRunId, stop: null });
    void get().maybeAutoAdvanceWorkflow(sessionId);
  };
};

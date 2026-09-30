import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { clearOrchestrationOutcome } from './clearOrchestrationOutcome';
import type { GetFn, SetFn } from './types';
import { sessionById } from '../sessions/sessionIndex';

export const continueWorkflowRun = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, workflowRunId: WorkflowRunId) => {
    const session = sessionById(get().sessions, sessionId);
    const run = session?.workflowRuns.find((candidate) => candidate.id === workflowRunId);
    if (run == null || run.executionMode !== 'dynamic') {
      return;
    }
    await clearOrchestrationOutcome({ set, sessionId, workflowRunId });
    await get().orchestrateNextStep(sessionId, workflowRunId);
  };
};

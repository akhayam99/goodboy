import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { clearOrchestrationOutcome } from './clearOrchestrationOutcome';
import type { GetFn, SetFn } from './types';

export const continueWorkflowRun = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, workflowRunId: WorkflowRunId, note?: string) => {
    const session = get().sessions.find((candidate) => candidate.id === sessionId);
    const run = session?.workflowRuns.find((candidate) => candidate.id === workflowRunId);
    if (run == null || run.executionMode !== 'dynamic') {
      return;
    }
    const trimmed = note?.trim() ?? '';
    await clearOrchestrationOutcome({ set, sessionId, workflowRunId });
    await get().orchestrateNextStep(sessionId, workflowRunId, {
      ...(trimmed !== '' && { extraHints: trimmed }),
    });
  };
};

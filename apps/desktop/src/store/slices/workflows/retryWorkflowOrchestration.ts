import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { updateWorkflowRunOrchestrationOutcome } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export const retryWorkflowOrchestration = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, workflowRunId: WorkflowRunId): Promise<void> => {
    const session = get().sessions.find((candidate) => candidate.id === sessionId);
    const run = session?.workflowRuns.find((candidate) => candidate.id === workflowRunId);
    if (session == null || run == null || run.executionMode !== 'dynamic') {
      return;
    }
    await updateWorkflowRunOrchestrationOutcome(tauriDatabase, workflowRunId, null);
    set((state) => ({
      sessions: state.sessions.map((candidate) =>
        candidate.id === sessionId
          ? {
              ...candidate,
              workflowRuns: candidate.workflowRuns.map((current) => {
                if (current.id !== workflowRunId) {
                  return current;
                }
                const { orchestrationOutcome: _cleared, ...rest } = current;
                return rest;
              }),
            }
          : candidate,
      ),
    }));
    await get().orchestrateNextStep(sessionId, workflowRunId);
  };
};

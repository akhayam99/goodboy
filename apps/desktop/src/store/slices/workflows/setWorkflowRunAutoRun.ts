import type { IsoDateTime, SessionId, WorkflowRunId } from '@goodboy/types';
import { updateSessionWorkflowAutoRun } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { persistOrchestrationStop } from './orchestrateNextStep';
import type { GetFn, SetFn } from './types';

export const setWorkflowRunAutoRun = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, workflowRunId: WorkflowRunId, autoRun: boolean) => {
    const now = new Date().toISOString() as IsoDateTime;
    await updateSessionWorkflowAutoRun(tauriDatabase, sessionId, workflowRunId, autoRun, now);
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              workflowRuns: s.workflowRuns.map((r) =>
                r.id === workflowRunId ? { ...r, autoRun } : r,
              ),
              updatedAt: now,
            }
          : s,
      ),
    }));
    if (!autoRun) {
      return;
    }
    const run = get()
      .sessions.find((s) => s.id === sessionId)
      ?.workflowRuns.find((r) => r.id === workflowRunId);
    if (run?.orchestrationStop?.kind === 'operator') {
      await persistOrchestrationStop({ set, sessionId, workflowRunId, stop: null });
    }
    void get().maybeAutoAdvanceWorkflow(sessionId);
  };
};

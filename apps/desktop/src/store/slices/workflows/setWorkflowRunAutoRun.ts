import type { IsoDateTime, SessionId, WorkflowRunId } from '@goodboy/types';
import { updateSessionWorkflowAutoRun } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export function setWorkflowRunAutoRun(set: SetFn, get: GetFn) {
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
    if (autoRun) void get().maybeAutoAdvanceWorkflow(sessionId);
  };
}

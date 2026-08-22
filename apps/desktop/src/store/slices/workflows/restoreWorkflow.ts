import type { IsoDateTime, SessionId, WorkflowRunId } from '@goodboy/types';
import { restoreWorkflowInSession } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export const restoreWorkflow = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, workflowRunId: WorkflowRunId) => {
    const state = get();
    const session = state.sessions.find((s) => s.id === sessionId);
    if (!session) {
      return;
    }
    const run = session.workflowRuns.find((r) => r.id === workflowRunId);
    if (!run || !run.discardedAt) {
      return;
    }

    const now = new Date().toISOString() as IsoDateTime;
    await restoreWorkflowInSession(tauriDatabase, sessionId, workflowRunId, now);

    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId
          ? {
              ...sess,
              workflowRuns: sess.workflowRuns.map((r) => {
                if (r.id !== workflowRunId) {
                  return r;
                }
                const { discardedAt: _discardedAt, ...rest } = r;
                return rest;
              }),
              updatedAt: now,
            }
          : sess,
      ),
    }));

    const restored = (state.sessionWorkflows?.[sessionId] ?? []).find(
      (workflow) => workflow.id === run.workflowId,
    );
    await get().recordSessionEvent({
      sessionId,
      kind: 'workflow_restored',
      payload: {
        runId: workflowRunId,
        ...(restored == null ? {} : { workflowName: restored.name }),
      },
    });
  };
};

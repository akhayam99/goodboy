import type { IsoDateTime, SessionId, WorkflowRunId } from '@goodboy/types';
import { detachWorkflowFromSession as detachWorkflowFromSessionInDb } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export const detachWorkflowFromSession = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, workflowRunId: WorkflowRunId) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) {
      throw new Error(`session not found: ${sessionId}`);
    }
    const run = session.workflowRuns.find((r) => r.id === workflowRunId);
    if (!run) {
      return;
    }

    const now = new Date().toISOString() as IsoDateTime;
    await detachWorkflowFromSessionInDb(tauriDatabase, sessionId, workflowRunId, now);

    const remaining = session.workflowRuns.filter((r) => r.id !== workflowRunId);
    const stillUsesTemplate = remaining.some((r) => r.workflowId === run.workflowId);

    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, workflowRuns: remaining, updatedAt: now } : s,
      ),
      sessionWorkflows: {
        ...state.sessionWorkflows,
        [sessionId]: stillUsesTemplate
          ? (state.sessionWorkflows[sessionId] ?? [])
          : (state.sessionWorkflows[sessionId] ?? []).filter((w) => w.id !== run.workflowId),
      },
    }));
  };
};

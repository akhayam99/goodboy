import type { IsoDateTime, SessionId, WorkflowId } from '@goodboy/types';
import { detachWorkflowFromSession as detachWorkflowFromSessionInDb } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export function detachWorkflowFromSession(set: SetFn, get: GetFn) {
  return async (sessionId: SessionId, workflowId: WorkflowId) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error(`session not found: ${sessionId}`);
    if (!session.workflowIds.includes(workflowId)) return;

    const now = new Date().toISOString() as IsoDateTime;
    await detachWorkflowFromSessionInDb(tauriDatabase, sessionId, workflowId, now);

    set((state) => ({
      sessions: state.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        const { [workflowId]: _dropped, ...rest } = s.currentStepByWorkflow;
        return {
          ...s,
          workflowIds: s.workflowIds.filter((id) => id !== workflowId),
          currentStepByWorkflow: rest,
          updatedAt: now,
        };
      }),
      sessionWorkflows: {
        ...state.sessionWorkflows,
        [sessionId]: (state.sessionWorkflows[sessionId] ?? []).filter((w) => w.id !== workflowId),
      },
    }));
  };
}

import type { IsoDateTime, SessionId, Workflow, WorkflowId } from '@goodboy/types';
import { updateWorkflowOrder } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export function reorderSessionWorkflows(set: SetFn, get: GetFn) {
  return async (sessionId: SessionId, workflowIds: ReadonlyArray<WorkflowId>) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error(`session not found: ${sessionId}`);
    const set1 = new Set(workflowIds);
    const set2 = new Set(session.workflowIds);
    if (set1.size !== set2.size || ![...set1].every((id) => set2.has(id))) {
      throw new Error('reorder list must be a permutation of the current workflow set');
    }
    const now = new Date().toISOString() as IsoDateTime;
    await updateWorkflowOrder(tauriDatabase, sessionId, workflowIds, now);

    const templates = get().phaseTemplates[session.workspaceId] ?? [];
    const reordered = workflowIds
      .map((id) => templates.find((t) => t.id === id) ?? null)
      .filter((t): t is Workflow => t !== null);

    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, workflowIds, updatedAt: now } : s,
      ),
      sessionWorkflows: { ...state.sessionWorkflows, [sessionId]: reordered },
    }));
  };
}

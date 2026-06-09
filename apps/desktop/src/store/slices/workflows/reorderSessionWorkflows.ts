import type { IsoDateTime, SessionId, WorkflowRunId } from '@goodboy/types';
import { updateWorkflowOrder } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export const reorderSessionWorkflows = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, workflowRunIds: ReadonlyArray<WorkflowRunId>) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error(`session not found: ${sessionId}`);
    const set1 = new Set(workflowRunIds);
    const set2 = new Set(session.workflowRuns.map((r) => r.id));
    if (set1.size !== set2.size || ![...set1].every((id) => set2.has(id))) {
      throw new Error('reorder list must be a permutation of the current workflow run set');
    }
    const now = new Date().toISOString() as IsoDateTime;
    await updateWorkflowOrder(tauriDatabase, sessionId, workflowRunIds, now);

    const byId = new Map(session.workflowRuns.map((r) => [r.id, r]));
    const reordered = workflowRunIds.map((id, ordinal) => ({ ...byId.get(id)!, ordinal }));

    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, workflowRuns: reordered, updatedAt: now } : s,
      ),
    }));
  };
};

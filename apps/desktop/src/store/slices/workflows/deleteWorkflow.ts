import type { IsoDateTime, Workflow, WorkflowId, WorkspaceId } from '@goodboy/types';
import { invokeWorkflowDelete } from '../../../features/workflows/workflows';
import type { SetFn } from './types';

// Soft-delete a workflow. The Rust side stamps deleted_at (it never hard-deletes
// anymore), so sessions that already ran the workflow keep it. In memory we mark
// the workflow `deletedAt` in place rather than dropping it: the preset picker
// filters deleted ones out, but in-session resolution (which reads
// phaseTemplates) and the per-session snapshots must keep it.
export const deleteWorkflow = (set: SetFn) => {
  return async (id: WorkflowId, workspaceId: WorkspaceId) => {
    await invokeWorkflowDelete(id);
    const now = new Date().toISOString() as IsoDateTime;
    const markDeleted = (w: Workflow): Workflow => (w.id === id ? { ...w, deletedAt: now } : w);
    set((state) => {
      const list = state.phaseTemplates[workspaceId] ?? [];
      const nextSessionWorkflows: Record<string, ReadonlyArray<Workflow>> = {};
      for (const [sid, wfs] of Object.entries(state.sessionWorkflows)) {
        nextSessionWorkflows[sid] = wfs.map(markDeleted);
      }
      return {
        phaseTemplates: { ...state.phaseTemplates, [workspaceId]: list.map(markDeleted) },
        sessionWorkflows: nextSessionWorkflows,
      };
    });
  };
};

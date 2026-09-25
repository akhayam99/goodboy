import type { IsoDateTime, SessionId, Workflow, WorkflowId, WorkspaceId } from '@goodboy/types';
import { invokeWorkflowDelete } from '../../../features/workflows/workflows';
import type { GetFn, SetFn } from './types';

export const deleteWorkflow = (set: SetFn, get: GetFn) => {
  return async (id: WorkflowId, workspaceId: WorkspaceId) => {
    const deletedName =
      Object.values(get().sessionWorkflows)
        .flat()
        .find((workflow) => workflow.id === id)?.name ??
      (get().phaseTemplates[workspaceId] ?? []).find((workflow) => workflow.id === id)?.name ??
      null;
    const affectedSessionIds = Object.entries(get().sessionWorkflows).flatMap(
      ([sessionId, workflows]) =>
        workflows.some((workflow) => workflow.id === id && workflow.deletedAt == null)
          ? [sessionId as SessionId]
          : [],
    );
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
    for (const sessionId of affectedSessionIds) {
      await get().recordSessionEvent({
        sessionId,
        kind: 'workflow_deleted',
        payload: deletedName == null ? {} : { workflowName: deletedName },
      });
    }
  };
};

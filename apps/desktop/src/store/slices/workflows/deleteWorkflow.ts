import type { WorkflowId, WorkspaceId } from '@goodboy/types';
import { invokeWorkflowDelete, invokeWorkflowList } from '../../../features/workflows/workflows';
import type { SetFn } from './types';

export function deleteWorkflow(set: SetFn) {
  return async (id: WorkflowId, workspaceId: WorkspaceId) => {
    await invokeWorkflowDelete(id);
    const templates = await invokeWorkflowList(workspaceId);
    set((state) => ({
      phaseTemplates: { ...state.phaseTemplates, [workspaceId]: templates },
    }));
  };
}

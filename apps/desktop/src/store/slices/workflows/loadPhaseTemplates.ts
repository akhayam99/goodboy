import type { WorkspaceId } from '@goodboy/types';
import { invokeWorkflowList } from '../../../features/workflows/workflows';
import type { SetFn } from './types';

export function loadPhaseTemplates(set: SetFn) {
  return async (workspaceId: WorkspaceId) => {
    const templates = await invokeWorkflowList(workspaceId);
    set((state) => ({ phaseTemplates: { ...state.phaseTemplates, [workspaceId]: templates } }));
  };
}

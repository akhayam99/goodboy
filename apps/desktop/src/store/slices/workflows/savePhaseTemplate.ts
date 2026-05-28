import {
  invokeWorkflowList,
  invokeWorkflowUpsert,
  type WorkflowUpsertArgs,
} from '../../../features/workflows/workflows';
import type { SetFn } from './types';

export function savePhaseTemplate(set: SetFn) {
  return async (template: WorkflowUpsertArgs) => {
    await invokeWorkflowUpsert(template);
    const templates = await invokeWorkflowList(template.workspaceId);
    set((state) => ({
      phaseTemplates: { ...state.phaseTemplates, [template.workspaceId]: templates },
    }));
  };
}

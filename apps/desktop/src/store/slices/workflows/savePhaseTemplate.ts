import type { Workflow } from '@goodboy/types';
import {
  invokeWorkflowList,
  invokeWorkflowUpsert,
  type WorkflowUpsertArgs,
} from '../../../features/workflows/workflows';
import type { SetFn } from './types';

export function savePhaseTemplate(set: SetFn) {
  return async (template: WorkflowUpsertArgs) => {
    const saved = await invokeWorkflowUpsert(template);
    const presets = await invokeWorkflowList(template.workspaceId);
    // workflow_list only returns reusable presets. A non-preset (custom) save
    // must still land in phaseTemplates so the session can attach it right away
    // and in-session resolution can find it.
    const merged: ReadonlyArray<Workflow> = presets.some((t) => t.id === saved.id)
      ? presets
      : [...presets, saved];
    set((state) => ({
      phaseTemplates: { ...state.phaseTemplates, [template.workspaceId]: merged },
    }));
  };
}

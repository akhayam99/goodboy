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
    set((state) => {
      const freshIds = new Set([...presets.map((p) => p.id), saved.id]);
      const retained = (state.phaseTemplates[template.workspaceId] ?? []).filter(
        (w) => !freshIds.has(w.id) && (w.deletedAt != null || w.isPreset === false),
      );
      const merged: ReadonlyArray<Workflow> = presets.some((t) => t.id === saved.id)
        ? [...presets, ...retained]
        : [...presets, saved, ...retained];
      return {
        phaseTemplates: { ...state.phaseTemplates, [template.workspaceId]: merged },
      };
    });
  };
}

import type { WorkspaceId } from '@goodboy/types';
import { invokeWorkflowList } from '../../../features/workflows/workflows';
import type { SetFn } from './types';

export function loadPhaseTemplates(set: SetFn) {
  return async (workspaceId: WorkspaceId) => {
    const presets = await invokeWorkflowList(workspaceId);
    set((state) => {
      const existing = state.phaseTemplates[workspaceId] ?? [];
      const freshIds = new Set(presets.map((p) => p.id));
      // workflow_list only returns live presets. Keep any deleted-but-attached or
      // one-off custom (isPreset === false) workflows already in memory so
      // in-session resolution doesn't lose a workflow a session still uses.
      const retained = existing.filter(
        (w) => !freshIds.has(w.id) && (w.deletedAt != null || w.isPreset === false),
      );
      return {
        phaseTemplates: { ...state.phaseTemplates, [workspaceId]: [...presets, ...retained] },
      };
    });
  };
}

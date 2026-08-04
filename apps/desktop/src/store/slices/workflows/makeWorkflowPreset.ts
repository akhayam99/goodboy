import type { WorkflowId, WorkspaceId } from '@goodboy/types';
import { invokeWorkflowUpsert } from '../../../features/workflows/workflows';
import type { GetFn, SetFn } from './types';

export const makeWorkflowPreset = (set: SetFn, get: GetFn) => {
  return async (workspaceId: WorkspaceId, workflowId: WorkflowId): Promise<void> => {
    const prev = (get().phaseTemplates[workspaceId] ?? []).find((w) => w.id === workflowId);
    if (!prev) {
      throw new Error(`workflow not found: ${workflowId}`);
    }
    if (prev.isPreset === true) {
      return;
    }
    const patch = (workflows: ReadonlyArray<typeof prev>, isPreset: boolean) =>
      workflows.map((w) => (w.id === workflowId ? { ...w, isPreset } : w));
    set((state) => ({
      phaseTemplates: {
        ...state.phaseTemplates,
        [workspaceId]: patch(state.phaseTemplates[workspaceId] ?? [], true),
      },
    }));
    try {
      const saved = await invokeWorkflowUpsert({
        id: prev.id,
        workspaceId: prev.workspaceId,
        name: prev.name,
        description: prev.description,
        ...(prev.goal != null && { goal: prev.goal }),
        ...(prev.processText != null && { processText: prev.processText }),
        steps: prev.steps,
        isPreset: true,
        ...(prev.origin != null && { origin: prev.origin }),
      });
      set((state) => ({
        phaseTemplates: {
          ...state.phaseTemplates,
          [workspaceId]: (state.phaseTemplates[workspaceId] ?? []).map((w) =>
            w.id === workflowId ? saved : w,
          ),
        },
      }));
    } catch (err) {
      set((state) => ({
        phaseTemplates: {
          ...state.phaseTemplates,
          [workspaceId]: patch(state.phaseTemplates[workspaceId] ?? [], false),
        },
      }));
      throw err;
    }
  };
};

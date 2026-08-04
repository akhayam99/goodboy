import type { WorkflowId, WorkspaceId } from '@goodboy/types';
import { invokeWorkflowUpsert } from '../../../features/workflows/workflows';
import { clampWorkflowTitle } from './titleLimit';
import {
  markWorkflowTitleUserEdited,
  unmarkWorkflowTitleUserEdited,
} from './workflowTitleUserEdited';
import type { GetFn, SetFn } from './types';

export const renameWorkflow = (set: SetFn, get: GetFn) => {
  return async (workspaceId: WorkspaceId, workflowId: WorkflowId, name: string): Promise<void> => {
    const title = clampWorkflowTitle(name);
    if (!title) {
      throw new Error('workflow name cannot be empty');
    }
    const prev = (get().phaseTemplates[workspaceId] ?? []).find((w) => w.id === workflowId);
    if (!prev) {
      throw new Error(`workflow not found: ${workflowId}`);
    }
    markWorkflowTitleUserEdited(workflowId);
    set((state) => ({
      phaseTemplates: {
        ...state.phaseTemplates,
        [workspaceId]: (state.phaseTemplates[workspaceId] ?? []).map((w) =>
          w.id === workflowId ? { ...w, name: title } : w,
        ),
      },
    }));
    try {
      const saved = await invokeWorkflowUpsert({
        id: prev.id,
        workspaceId: prev.workspaceId,
        name: title,
        description: prev.description,
        ...(prev.goal != null && { goal: prev.goal }),
        ...(prev.processText != null && { processText: prev.processText }),
        steps: prev.steps,
        ...(prev.isPreset != null && { isPreset: prev.isPreset }),
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
      unmarkWorkflowTitleUserEdited(workflowId);
      set((state) => ({
        phaseTemplates: {
          ...state.phaseTemplates,
          [workspaceId]: (state.phaseTemplates[workspaceId] ?? []).map((w) =>
            w.id === workflowId ? prev : w,
          ),
        },
      }));
      throw err;
    }
  };
};

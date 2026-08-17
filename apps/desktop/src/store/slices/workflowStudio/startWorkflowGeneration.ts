import { formatWorkflowFromNL } from '@goodboy/core';
import { invoke } from '@tauri-apps/api/core';
import type { WorkflowUpsertArgs } from '../../../features/workflows/workflows';
import { formatError } from '@goodboy/ui';
import type { GetFn, SetFn, StartWorkflowGenerationParams } from './types';

export const startWorkflowGeneration = (set: SetFn, get: GetFn) => {
  return async ({
    workspaceId,
    providerId,
    description,
    workingDir,
    workflow,
    form,
  }: StartWorkflowGenerationParams): Promise<boolean> => {
    const current = get().workflowGenerations[workspaceId];
    if (current?.status === 'running') {
      return false;
    }
    const cleanDescription = description.trim();
    set((state) => ({
      workflowGenerations: {
        ...state.workflowGenerations,
        [workspaceId]: { status: 'running', description: cleanDescription },
      },
    }));
    try {
      const formatted = await formatWorkflowFromNL(
        { providerId, invokeFn: invoke, ...(workingDir !== undefined && { workingDir }) },
        {
          description: cleanDescription,
          ...(form !== null && {
            currentName: form.name,
            currentDescription: form.description,
            currentStepNames: form.steps
              .map((step) => step.name)
              .filter((name) => name.trim().length > 0),
          }),
        },
      );
      if (formatted === null) {
        throw new Error(
          'The agent could not build a workflow from that description. Try adding the outcome and the steps you expect.',
        );
      }
      const args: WorkflowUpsertArgs = {
        ...(workflow !== null && { id: workflow.id }),
        workspaceId,
        name: formatted.name.trim().length > 0 ? formatted.name : 'Generated workflow',
        description: formatted.description,
        ...(formatted.goal !== undefined && { goal: formatted.goal }),
        steps: formatted.steps.map((step, ordinal) => ({
          role: step.role,
          ordinal,
          name: step.name,
          promptPrefix: step.promptPrefix,
          expectedOutput: step.expectedOutput,
        })),
        isPreset: true,
        origin: 'custom',
      };
      const saved = await get().savePhaseTemplate(args);
      get().clearWorkflowStudioDraft({ workspaceId });
      set((state) => ({
        workflowGenerations: {
          ...state.workflowGenerations,
          [workspaceId]: {
            status: 'complete',
            workspaceId,
            workflowId: saved.id,
            notificationId: crypto.randomUUID(),
            undoSnapshot: workflow,
          },
        },
      }));
      return true;
    } catch (error) {
      set((state) => ({
        workflowGenerations: {
          ...state.workflowGenerations,
          [workspaceId]: {
            status: 'failed',
            description: cleanDescription,
            error: formatError(error),
          },
        },
      }));
      return false;
    }
  };
};

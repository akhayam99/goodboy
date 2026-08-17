import type { GetFn, SetFn } from './types';
import type { WorkspaceId } from '@goodboy/types';
import type { WorkflowUpsertArgs } from '../../../features/workflows/workflows';

export type Params = { readonly workspaceId: WorkspaceId };

export const undoWorkflowGeneration = (_set: SetFn, get: GetFn) => {
  return async ({ workspaceId }: Params): Promise<void> => {
    const generation = get().workflowGenerations[workspaceId];
    if (generation?.status !== 'complete' || generation.undoSnapshot === null) {
      return;
    }
    const snapshot = generation.undoSnapshot;
    const args: WorkflowUpsertArgs = {
      id: snapshot.id,
      workspaceId,
      name: snapshot.name,
      description: snapshot.description,
      ...(snapshot.goal !== undefined && { goal: snapshot.goal }),
      steps: snapshot.steps.map((step) => ({
        id: step.id,
        ...(step.libraryStepId !== undefined && { libraryStepId: step.libraryStepId }),
        role: step.role,
        ordinal: step.ordinal,
        name: step.name,
        promptPrefix: step.promptPrefix,
        ...(step.expectedOutput !== undefined && { expectedOutput: step.expectedOutput }),
        ...(step.providerOverride !== undefined && { providerOverride: step.providerOverride }),
        ...(step.modelOverride !== undefined && { modelOverride: step.modelOverride }),
        ...(step.effort !== undefined && { effort: step.effort }),
        ...(step.verbosity !== undefined && { verbosity: step.verbosity }),
      })),
      isPreset: true,
      ...(snapshot.origin !== undefined && { origin: snapshot.origin }),
    };
    await get().savePhaseTemplate(args);
    get().consumeWorkflowGeneration({ workspaceId });
  };
};

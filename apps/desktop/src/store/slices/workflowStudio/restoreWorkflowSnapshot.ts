import type { Workflow, WorkspaceId } from '@goodboy/types';
import { draftFromWorkflow } from '../../../features/workflows/engine';
import type { WorkflowUpsertArgs } from '../../../features/workflows/workflows';
import type { GetFn, SetFn } from './types';

export type Params = {
  readonly workspaceId: WorkspaceId;
  readonly snapshot: Workflow;
};

const upsertArgsOf = ({ workspaceId, snapshot }: Params): WorkflowUpsertArgs => ({
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
});

export const restoreWorkflowSnapshot = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId, snapshot }: Params): Promise<boolean> => {
    const exists = (get().phaseTemplates[workspaceId] ?? []).some(
      (template) => template.id === snapshot.id,
    );
    if (!exists) {
      return false;
    }
    await get().savePhaseTemplate(upsertArgsOf({ workspaceId, snapshot }));
    const stored = get().workflowStudioDrafts[workspaceId];
    if (stored?.workflowId === snapshot.id) {
      set((state) => ({
        workflowStudioDrafts: {
          ...state.workflowStudioDrafts,
          [workspaceId]: {
            workflowId: snapshot.id,
            form: draftFromWorkflow({ workflow: snapshot }),
            restoreNonce: crypto.randomUUID(),
          },
        },
      }));
    }
    return true;
  };
};

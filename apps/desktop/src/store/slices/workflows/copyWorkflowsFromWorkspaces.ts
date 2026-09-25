import type { StepDefId, StepId, Workflow, WorkflowId, WorkspaceId } from '@goodboy/types';
import { isImportableWorkflow } from '../../../features/workflows/isImportableWorkflow';
import { invokeWorkflowList, invokeWorkflowUpsert } from '../../../features/workflows/workflows';
import { importedWorkflowName } from './importedWorkflowName';
import type { SetFn } from './types';

export type WorkflowImportPick = {
  readonly workflow: Workflow;
  readonly sourceWorkspaceName: string;
};

export type CopyWorkflowsFromWorkspacesParams = {
  readonly picks: ReadonlyArray<WorkflowImportPick>;
  readonly targetWorkspaceId: WorkspaceId;
};

type FactoryParams = {
  readonly set: SetFn;
};

const BUILTIN_STEP_PREFIX = 'seed_';

type LibraryLinkParams = {
  readonly libraryStepId: StepDefId | null | undefined;
};

const sharedLibraryStepId = ({ libraryStepId }: LibraryLinkParams): StepDefId | null =>
  libraryStepId != null && libraryStepId.startsWith(BUILTIN_STEP_PREFIX) ? libraryStepId : null;

type CopyParams = {
  readonly workflow: Workflow;
  readonly name: string;
  readonly targetWorkspaceId: WorkspaceId;
};

const copyWorkflow = ({ workflow, name, targetWorkspaceId }: CopyParams): Promise<Workflow> =>
  invokeWorkflowUpsert({
    id: crypto.randomUUID() as WorkflowId,
    workspaceId: targetWorkspaceId,
    name,
    description: workflow.description,
    ...(workflow.goal != null && { goal: workflow.goal }),
    ...(workflow.processText != null && { processText: workflow.processText }),
    isPreset: true,
    origin: 'custom',
    steps: workflow.steps.map((step) => {
      const libraryStepId = sharedLibraryStepId({ libraryStepId: step.libraryStepId });
      return {
        id: crypto.randomUUID() as StepId,
        ...(libraryStepId !== null && { libraryStepId }),
        ...(step.role != null && { role: step.role }),
        ordinal: step.ordinal,
        name: step.name,
        promptPrefix: step.promptPrefix,
        ...(step.expectedOutput != null && { expectedOutput: step.expectedOutput }),
        ...(step.providerOverride != null && { providerOverride: step.providerOverride }),
        ...(step.modelOverride != null && { modelOverride: step.modelOverride }),
        ...(step.effort != null && { effort: step.effort }),
        ...(step.verbosity != null && { verbosity: step.verbosity }),
        ...(step.orchestratorReason != null && {
          orchestratorReason: step.orchestratorReason,
        }),
      };
    }),
  });

type RefreshParams = {
  readonly set: SetFn;
  readonly targetWorkspaceId: WorkspaceId;
  readonly saved: ReadonlyArray<Workflow>;
};

const refreshTarget = async ({ set, targetWorkspaceId, saved }: RefreshParams): Promise<void> => {
  const presets = await invokeWorkflowList(targetWorkspaceId);
  set((state) => {
    const listedIds = new Set(presets.map((workflow) => workflow.id));
    const savedIds = new Set(saved.map((workflow) => workflow.id));
    const retained = (state.phaseTemplates[targetWorkspaceId] ?? []).filter(
      (workflow) =>
        !listedIds.has(workflow.id) &&
        !savedIds.has(workflow.id) &&
        (workflow.deletedAt != null || workflow.isPreset === false),
    );
    const missing = saved.filter((workflow) => !listedIds.has(workflow.id));
    return {
      phaseTemplates: {
        ...state.phaseTemplates,
        [targetWorkspaceId]: [...presets, ...missing, ...retained],
      },
    };
  });
};

export const copyWorkflowsFromWorkspaces = ({ set }: FactoryParams) => {
  return async ({
    picks,
    targetWorkspaceId,
  }: CopyWorkflowsFromWorkspacesParams): Promise<ReadonlyArray<Workflow>> => {
    if (picks.some((pick) => !isImportableWorkflow(pick.workflow))) {
      throw new Error('only custom presets can be imported');
    }
    const existing = await invokeWorkflowList(targetWorkspaceId);
    const taken = new Set(
      existing.filter((workflow) => workflow.deletedAt == null).map((workflow) => workflow.name),
    );
    const saved: Array<Workflow> = [];
    try {
      for (const pick of picks) {
        const name = importedWorkflowName({
          name: pick.workflow.name,
          sourceWorkspaceName: pick.sourceWorkspaceName,
          taken,
        });
        taken.add(name);
        saved.push(await copyWorkflow({ workflow: pick.workflow, name, targetWorkspaceId }));
      }
    } finally {
      if (saved.length > 0) {
        await refreshTarget({ set, targetWorkspaceId, saved });
      }
    }
    return saved;
  };
};

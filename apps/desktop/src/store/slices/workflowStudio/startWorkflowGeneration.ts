import {
  formatWorkflowFromNL,
  orchestratorModelPool,
  resolveTaskModel,
  type FormattedWorkflowStep,
  type OrchestratorModelOption,
  type WorkflowRoutingAvailabilitySnapshot,
} from '@goodboy/core';
import { invoke } from '@tauri-apps/api/core';
import type {
  WorkflowStepUpsertArgs,
  WorkflowUpsertArgs,
} from '../../../features/workflows/workflows';
import { resolveGeneratedStepRouting } from '../../../features/workflows/resolveGeneratedStepRouting';
import { workflowAvailabilitySnapshot } from '../../../features/workflows/workflowAvailabilitySnapshot';
import { workflowRoutingFlags } from '../../../features/workflows/workflowRoutingFlags';
import { formatError } from '@goodboy/ui';
import { DEFAULT_SESSION_PROVIDER_PREFERENCE } from '@goodboy/types';
import type { ProviderId, TaskModelPreference, WorkspaceId } from '@goodboy/types';
import type { GetFn, SetFn, StartWorkflowGenerationParams } from './types';

type GenerationModelParams = {
  readonly state: ReturnType<GetFn>;
  readonly workspaceId: WorkspaceId;
};

const generationTaskModel = ({
  state,
  workspaceId,
}: GenerationModelParams): TaskModelPreference => {
  const overrides = state.workspaceOverrides?.[workspaceId] ?? null;
  const connected = state.providers
    .filter((provider) => provider.connection === 'connected')
    .map((provider) => provider.id);
  const firstConnected = connected[0];
  const resolved = resolveTaskModel({
    task: 'plan_generation',
    preferences: overrides?.taskModels,
    workspaceDefaultProviderId: overrides?.defaultProviderId,
    sessionDefaultProviderId: firstConnected ?? DEFAULT_SESSION_PROVIDER_PREFERENCE.defaultProvider,
  });
  if (firstConnected == null || connected.includes(resolved.providerId)) {
    return resolved;
  }
  return resolveTaskModel({
    task: 'plan_generation',
    preferences: null,
    workspaceDefaultProviderId: firstConnected,
    sessionDefaultProviderId: firstConnected,
  });
};

type MenuParams = {
  readonly state: ReturnType<GetFn>;
};

const generationAvailability = ({ state }: MenuParams): WorkflowRoutingAvailabilitySnapshot =>
  workflowAvailabilitySnapshot({
    providers: state.providers ?? [],
    cooldowns: state.providerCooldowns ?? {},
    alerts: state.budgetAlerts ?? [],
    sessionId: null,
    isRunBudgetBlocked: false,
    nowMs: Date.now(),
  });

type GeneratedStepParams = {
  readonly step: FormattedWorkflowStep;
  readonly ordinal: number;
  readonly emittingProvider: ProviderId;
  readonly availability: WorkflowRoutingAvailabilitySnapshot | null;
};

const generatedStepArgs = ({
  step,
  ordinal,
  emittingProvider,
  availability,
}: GeneratedStepParams): WorkflowStepUpsertArgs => {
  const base = {
    role: step.role,
    ordinal,
    name: step.name,
    promptPrefix: step.promptPrefix,
    expectedOutput: step.expectedOutput,
  };
  if (availability === null) {
    return base;
  }
  const routing = resolveGeneratedStepRouting({
    routing: step.routing,
    promptPrefix: step.promptPrefix,
    emittingProvider,
    availability,
  });
  if (routing === null) {
    return base;
  }
  return {
    ...base,
    providerOverride: routing.providerOverride,
    modelOverride: routing.modelOverride,
    ...(routing.effort !== null && { effort: routing.effort }),
    routingDecision: routing.routingDecision,
    taskProfile: routing.taskProfile,
  };
};

export const startWorkflowGeneration = (set: SetFn, get: GetFn) => {
  return async ({
    workspaceId,
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
      const taskModel = generationTaskModel({ state: get(), workspaceId });
      const isModelMetadataEnabled = workflowRoutingFlags().isModelMetadataEnabled;
      const availability = isModelMetadataEnabled ? generationAvailability({ state: get() }) : null;
      const modelMenu: ReadonlyArray<OrchestratorModelOption> =
        availability === null ? [] : orchestratorModelPool({ availability });
      const formatted = await formatWorkflowFromNL({
        deps: {
          ...taskModel,
          invokeFn: invoke,
          ...(workingDir !== undefined && { workingDir }),
        },
        input: {
          description: cleanDescription,
          ...(modelMenu.length > 0 && { modelMenu }),
          ...(form !== null && {
            currentName: form.name,
            currentDescription: form.description,
            currentStepNames: form.steps
              .map((step) => step.name)
              .filter((name) => name.trim().length > 0),
          }),
        },
      });
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
        steps: formatted.steps.map((step, ordinal) =>
          generatedStepArgs({
            step,
            ordinal,
            emittingProvider: taskModel.providerId,
            availability,
          }),
        ),
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

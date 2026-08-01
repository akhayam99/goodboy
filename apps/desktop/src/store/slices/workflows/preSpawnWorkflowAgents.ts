import type {
  Agent,
  ModelEffort,
  OrchestratorRouting,
  ProviderId,
  RoleModelPreferences,
  SessionId,
  Step,
  VerbosityLevel,
  WorkflowRunId,
} from '@goodboy/types';
import { recommendedModelForRole, resolveModelForProvider } from '@goodboy/core';
import {
  ROLE_TO_KIND,
  inferAgentKindFromName,
  kindRouting,
} from '../../../features/session/agent-kind';
import { invokeAgentInsert } from '../../../features/workflows/workflows';

type Params = {
  readonly sessionId: SessionId;
  readonly workflowRunId?: WorkflowRunId;
  readonly steps: ReadonlyArray<Step>;
  readonly baseOrdinal: number;
  readonly defaultProvider: ProviderId;
  readonly roleModels: RoleModelPreferences | null;
  readonly defaultVerbosity?: VerbosityLevel;
  readonly routingOverride?: OrchestratorRouting;
};

type PreSpawnWorkflowAgentsResult = {
  readonly agents: ReadonlyArray<Agent>;
  readonly modelOverrides: Readonly<Record<string, string>>;
  readonly kindOverrides: Readonly<Record<string, string>>;
  readonly providerOverrides: Readonly<Record<string, ProviderId>>;
  readonly effortOverrides: Readonly<Record<string, ModelEffort>>;
};

export const preSpawnWorkflowAgents = async ({
  sessionId,
  workflowRunId,
  steps,
  baseOrdinal,
  defaultProvider,
  roleModels,
  defaultVerbosity,
  routingOverride,
}: Params): Promise<PreSpawnWorkflowAgentsResult> => {
  const agents: Agent[] = [];
  const modelOverrides: Record<string, string> = {};
  const kindOverrides: Record<string, string> = {};
  const providerOverrides: Record<string, ProviderId> = {};
  const effortOverrides: Record<string, ModelEffort> = {};
  const sortedSteps = [...steps].sort((left, right) => left.ordinal - right.ordinal);

  for (const [index, step] of sortedSteps.entries()) {
    const kind = step.role ? ROLE_TO_KIND[step.role] : inferAgentKindFromName(step.name);
    const provider = routingOverride?.providerId ?? step.providerOverride ?? defaultProvider;
    const model = resolveModelForProvider({
      provider,
      modelId:
        routingOverride?.model ??
        step.modelOverride ??
        (step.role != null
          ? recommendedModelForRole({
              role: step.role,
              provider,
              prefs: roleModels,
            })
          : kindRouting({ kind, roleModels }).model),
    });
    const agent = await invokeAgentInsert({
      sessionId,
      stepId: step.id,
      ...(workflowRunId != null && { workflowRunId }),
      ordinal: baseOrdinal + index,
      name: step.name,
      status: 'pending',
      kind,
      ...(defaultVerbosity != null && { verbosity: defaultVerbosity }),
      providerOverride: provider,
      modelOverride: model,
      ...(routingOverride?.effort != null && { effort: routingOverride.effort }),
      ...(routingOverride == null && step.effort != null && { effort: step.effort }),
    });
    providerOverrides[agent.id] = provider;
    modelOverrides[agent.id] = model;
    kindOverrides[agent.id] = kind;
    const effort = routingOverride == null ? step.effort : routingOverride.effort;
    if (effort != null) {
      effortOverrides[agent.id] = effort;
    }
    agents.push(agent);
  }

  return { agents, modelOverrides, kindOverrides, providerOverrides, effortOverrides };
};

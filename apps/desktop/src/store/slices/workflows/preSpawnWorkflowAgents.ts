import type {
  Agent,
  ModelEffort,
  ProviderId,
  RoleModelPreferences,
  SessionId,
  Step,
  VerbosityLevel,
  WorkflowRunId,
} from '@goodboy/types';
import { resolveModelForProvider, type WorkflowRoutingAvailabilitySnapshot } from '@goodboy/core';
import { ROLE_TO_KIND, inferAgentKindFromName } from '../../../features/session/agent-kind';
import { resolveStepRouting } from '../../../features/workflows/resolveStepRouting';
import { revalidateStepRouting } from '../../../features/workflows/revalidateStepRouting';
import { invokeAgentInsert } from '../../../features/workflows/workflows';

type Params = {
  readonly sessionId: SessionId;
  readonly workflowRunId?: WorkflowRunId;
  readonly steps: ReadonlyArray<Step>;
  readonly baseOrdinal: number;
  readonly defaultProvider: ProviderId;
  readonly roleModels: RoleModelPreferences | null;
  readonly sessionModel?: string | null;
  readonly sessionEffort?: ModelEffort | null;
  readonly defaultVerbosity?: VerbosityLevel;
  readonly availability?: WorkflowRoutingAvailabilitySnapshot;
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
  sessionModel,
  sessionEffort,
  defaultVerbosity,
  availability,
}: Params): Promise<PreSpawnWorkflowAgentsResult> => {
  const agents: Agent[] = [];
  const modelOverrides: Record<string, string> = {};
  const kindOverrides: Record<string, string> = {};
  const providerOverrides: Record<string, ProviderId> = {};
  const effortOverrides: Record<string, ModelEffort> = {};
  const sortedSteps = [...steps].sort((left, right) => left.ordinal - right.ordinal);

  for (const [index, step] of sortedSteps.entries()) {
    const kind = step.role ? ROLE_TO_KIND[step.role] : inferAgentKindFromName(step.name);
    const revalidated =
      availability === undefined ? null : revalidateStepRouting({ step, availability });
    const effectiveStep = revalidated?.step ?? step;
    const routing = resolveStepRouting({
      step: effectiveStep,
      kind,
      roleModels,
      sessionProvider: defaultProvider,
      sessionModel: sessionModel ?? null,
      sessionEffort: sessionEffort ?? null,
    });
    const provider = routing.provider;
    const model = resolveModelForProvider({ provider, modelId: routing.model });
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
      effort: routing.effort,
      routingLock: effectiveStep.routingLock ?? null,
      routingDecision: effectiveStep.routingDecision ?? null,
      taskProfile: effectiveStep.taskProfile ?? null,
    });
    providerOverrides[agent.id] = provider;
    modelOverrides[agent.id] = model;
    kindOverrides[agent.id] = kind;
    effortOverrides[agent.id] = routing.effort;
    agents.push(agent);
  }

  return { agents, modelOverrides, kindOverrides, providerOverrides, effortOverrides };
};

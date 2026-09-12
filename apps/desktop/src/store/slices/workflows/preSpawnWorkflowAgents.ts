import type {
  Agent,
  AgentRole,
  ModelEffort,
  ProviderId,
  RoleModelPreferences,
  SessionId,
  Step,
  StepId,
  VerbosityLevel,
  WorkflowModelPick,
  WorkflowRunId,
} from '@goodboy/types';
import {
  resolveModelIdForProvider,
  resolveRoleRouting,
  type WorkflowRoutingAvailabilitySnapshot,
} from '@goodboy/core';
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
  readonly runRoleModels?: RoleModelPreferences | null;
  readonly sessionModel?: string | null;
  readonly sessionEffort?: ModelEffort | null;
  readonly defaultVerbosity?: VerbosityLevel;
  readonly availability?: WorkflowRoutingAvailabilitySnapshot;
};

export type BlockedWorkflowStep = Readonly<{
  stepId: StepId;
  stepName: string;
  reason: string;
}>;

type PreSpawnWorkflowAgentsResult = {
  readonly agents: ReadonlyArray<Agent>;
  readonly modelOverrides: Readonly<Record<string, string>>;
  readonly kindOverrides: Readonly<Record<string, string>>;
  readonly providerOverrides: Readonly<Record<string, ProviderId>>;
  readonly effortOverrides: Readonly<Record<string, ModelEffort>>;
  readonly blocked: ReadonlyArray<BlockedWorkflowStep>;
};

type RunRoleLockParams = {
  readonly role: AgentRole | undefined;
  readonly runRoleModels: RoleModelPreferences | null;
};

const runRoleLockFor = ({ role, runRoleModels }: RunRoleLockParams): WorkflowModelPick | null => {
  if (role == null) {
    return null;
  }
  if (runRoleModels === null) {
    return null;
  }
  const routing = resolveRoleRouting({ role, prefs: runRoleModels });
  if (routing.isOverride === false) {
    return null;
  }
  return { provider: routing.provider, model: routing.model, effort: routing.effort };
};

export const preSpawnWorkflowAgents = async ({
  sessionId,
  workflowRunId,
  steps,
  baseOrdinal,
  defaultProvider,
  roleModels,
  runRoleModels,
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
  const blocked: Array<BlockedWorkflowStep> = [];
  const sortedSteps = [...steps].sort((left, right) => left.ordinal - right.ordinal);

  for (const step of sortedSteps) {
    const kind = step.role ? ROLE_TO_KIND[step.role] : inferAgentKindFromName(step.name);
    const revalidated =
      availability === undefined
        ? ({ kind: 'keep' } as const)
        : revalidateStepRouting({
            step,
            availability,
            runRoleLock: runRoleLockFor({
              role: step.role,
              runRoleModels: runRoleModels ?? null,
            }),
          });
    if (revalidated.kind === 'blocked') {
      blocked.push({ stepId: step.id, stepName: step.name, reason: revalidated.reason });
      continue;
    }
    const effectiveStep = revalidated.kind === 'replace' ? revalidated.step : step;
    const routing = resolveStepRouting({
      step: effectiveStep,
      kind,
      roleModels,
      sessionProvider: defaultProvider,
      sessionModel: sessionModel ?? null,
      sessionEffort: sessionEffort ?? null,
    });
    const provider = routing.provider;
    const model = resolveModelIdForProvider({ provider, modelId: routing.model });
    const agent = await invokeAgentInsert({
      sessionId,
      stepId: step.id,
      ...(workflowRunId != null && { workflowRunId }),
      ordinal: baseOrdinal + agents.length,
      name: step.name,
      status: 'pending',
      kind,
      ...(defaultVerbosity != null && { verbosity: defaultVerbosity }),
      providerOverride: provider,
      modelOverride: model,
      ...(routing.effort != null && { effort: routing.effort }),
      routingLock: effectiveStep.routingLock ?? null,
      routingDecision: effectiveStep.routingDecision ?? null,
      taskProfile: effectiveStep.taskProfile ?? null,
    });
    providerOverrides[agent.id] = provider;
    modelOverrides[agent.id] = model;
    kindOverrides[agent.id] = kind;
    if (routing.effort != null) {
      effortOverrides[agent.id] = routing.effort;
    }
    agents.push(agent);
  }

  return { agents, modelOverrides, kindOverrides, providerOverrides, effortOverrides, blocked };
};

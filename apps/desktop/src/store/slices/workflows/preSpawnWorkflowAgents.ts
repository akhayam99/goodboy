import type {
  Agent,
  EffortLevel,
  ProviderId,
  RoleModelPreferences,
  SessionId,
  Step,
  StepId,
  VerbosityLevel,
  WorkflowRunId,
} from '@goodboy/types';
import { resolveModelIdForProvider, type WorkflowRoutingAvailabilitySnapshot } from '@goodboy/core';
import { classifyStep } from '../../../features/session/agent-kind';
import { resolveStepRouting } from '../../../features/workflows/resolveStepRouting';
import { revalidateStepRouting } from '../../../features/workflows/revalidateStepRouting';
import {
  invokeAgentGenerationReserve,
  invokeAgentInsert,
} from '../../../features/workflows/workflows';

type Params = {
  readonly sessionId: SessionId;
  readonly workflowRunId?: WorkflowRunId;
  readonly steps: ReadonlyArray<Step>;
  readonly baseOrdinal: number;
  readonly defaultProvider: ProviderId;
  readonly roleModels: RoleModelPreferences | null;
  readonly sessionModel?: string | null;
  readonly sessionEffort?: EffortLevel | null;
  readonly defaultVerbosity?: VerbosityLevel;
  readonly availability?: WorkflowRoutingAvailabilitySnapshot;
};

type BlockedWorkflowStep = Readonly<{
  stepId: StepId;
  stepName: string;
  reason: string;
}>;

type PreSpawnWorkflowAgentsResult = {
  readonly agents: ReadonlyArray<Agent>;
  readonly modelOverrides: Readonly<Record<string, string>>;
  readonly kindOverrides: Readonly<Record<string, string>>;
  readonly providerOverrides: Readonly<Record<string, ProviderId>>;
  readonly effortOverrides: Readonly<Record<string, EffortLevel>>;
  readonly blocked: ReadonlyArray<BlockedWorkflowStep>;
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
  const effortOverrides: Record<string, EffortLevel> = {};
  const blocked: Array<BlockedWorkflowStep> = [];
  const sortedSteps = [...steps].sort((left, right) => left.ordinal - right.ordinal);

  for (const step of sortedSteps) {
    const kind = classifyStep({ step });
    const revalidated =
      availability === undefined
        ? ({ kind: 'keep' } as const)
        : revalidateStepRouting({
            step,
            availability,
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
    const reservation = await invokeAgentGenerationReserve({
      reservationId: `generation:workflow-step:${workflowRunId ?? sessionId}:${step.id}`,
      sessionId,
      workflowRunId: workflowRunId ?? null,
      parentAgentId: null,
      creationPath: 'workflow-step',
      count: 1,
    });
    if (reservation.kind === 'refused') {
      blocked.push({ stepId: step.id, stepName: step.name, reason: reservation.reason });
      continue;
    }
    const agent = await invokeAgentInsert({
      sessionId,
      stepId: step.id,
      ...(workflowRunId != null && { workflowRunId }),
      ordinal: baseOrdinal + agents.length,
      name: step.name,
      status: 'pending',
      executionPurpose: 'standalone',
      kind,
      ...(defaultVerbosity != null && { verbosity: defaultVerbosity }),
      providerOverride: provider,
      modelOverride: model,
      ...(routing.effort != null && { effort: routing.effort }),
      routingLock: effectiveStep.routingLock ?? null,
      routingDecision: effectiveStep.routingDecision ?? null,
      taskProfile: effectiveStep.taskProfile ?? null,
      generationReservationId: reservation.reservations[0]!.reservationId,
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

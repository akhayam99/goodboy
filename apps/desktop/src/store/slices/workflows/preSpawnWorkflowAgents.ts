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
import { recommendedModelForRole, resolveModelForProvider } from '@goodboy/core';
import { ROLE_TO_KIND, inferAgentKindFromName } from '../../../features/session/agent-kind';
import { invokeAgentInsert } from '../../../features/workflows/workflows';

type Params = {
  readonly sessionId: SessionId;
  readonly workflowRunId?: WorkflowRunId;
  readonly steps: ReadonlyArray<Step>;
  readonly baseOrdinal: number;
  readonly defaultProvider: ProviderId;
  readonly roleModels: RoleModelPreferences | null;
  readonly defaultVerbosity?: VerbosityLevel;
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
}: Params): Promise<PreSpawnWorkflowAgentsResult> => {
  const agents: Agent[] = [];
  const modelOverrides: Record<string, string> = {};
  const kindOverrides: Record<string, string> = {};
  const providerOverrides: Record<string, ProviderId> = {};
  const effortOverrides: Record<string, ModelEffort> = {};
  const sortedSteps = [...steps].sort((left, right) => left.ordinal - right.ordinal);

  for (const [index, step] of sortedSteps.entries()) {
    const kind = step.role ? ROLE_TO_KIND[step.role] : inferAgentKindFromName(step.name);
    const agent = await invokeAgentInsert({
      sessionId,
      stepId: step.id,
      ...(workflowRunId != null && { workflowRunId }),
      ordinal: baseOrdinal + index,
      name: step.name,
      status: 'pending',
      kind,
      ...(defaultVerbosity != null && { verbosity: defaultVerbosity }),
    });
    const provider = step.providerOverride ?? defaultProvider;
    providerOverrides[agent.id] = provider;
    modelOverrides[agent.id] = resolveModelForProvider({
      provider,
      modelId:
        step.modelOverride ??
        recommendedModelForRole({
          role: step.role ?? 'custom',
          provider,
          prefs: roleModels,
        }),
    });
    kindOverrides[agent.id] = kind;
    if (step.effort != null) {
      effortOverrides[agent.id] = step.effort;
    }
    agents.push(agent);
  }

  return { agents, modelOverrides, kindOverrides, providerOverrides, effortOverrides };
};

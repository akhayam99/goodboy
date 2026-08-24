import type {
  Agent,
  ModelEffort,
  ProviderId,
  RoleModelPreferences,
  Session,
  Step,
} from '@goodboy/types';
import { PROVIDER_CAPABILITIES, getDefaultTurnModel, resolveModelForProvider } from '@goodboy/core';
import { classifyAgent, type AgentKind } from '../../../features/session/agent-kind';
import { resolveStepRouting } from '../../../features/workflows/resolveStepRouting';

type Params = {
  readonly agent: Agent | null;
  readonly stepConfig: Step | null;
  readonly roleModels: RoleModelPreferences | null;
  readonly session: Session;
  readonly kindOverride?: AgentKind | null;
};

type AgentReferenceRouting = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: ModelEffort;
};

const sessionProviderOf = ({ session }: { readonly session: Session }): ProviderId => {
  const override = session.providerOverride;
  if (override != null && override in PROVIDER_CAPABILITIES) {
    return override as ProviderId;
  }
  return session.providerPreference.defaultProvider;
};

export const agentReferenceRouting = ({
  agent,
  stepConfig,
  roleModels,
  session,
  kindOverride = null,
}: Params): AgentReferenceRouting => {
  if (agent == null) {
    const provider = session.providerPreference.defaultProvider;
    const modelId =
      session.providerPreference.defaultModel ?? getDefaultTurnModel({ id: provider });
    return {
      provider,
      model: resolveModelForProvider({ provider, modelId }),
      effort: session.effort ?? 'medium',
    };
  }
  const kind = classifyAgent(agent, kindOverride);
  const routing = resolveStepRouting({
    step: stepConfig,
    kind,
    roleModels,
    sessionProvider: sessionProviderOf({ session }),
    sessionEffort: session.effort ?? null,
  });
  return {
    provider: routing.provider,
    model: resolveModelForProvider({ provider: routing.provider, modelId: routing.model }),
    effort: routing.effort,
  };
};

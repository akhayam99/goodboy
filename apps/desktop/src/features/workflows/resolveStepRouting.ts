import {
  providerStanding,
  recommendedModelForRole,
  resolveRoleRouting,
  type AutoContext,
} from '@goodboy/core';
import type { EffortLevel, ProviderId, RoleModelPreferences, Step } from '@goodboy/types';
import { KIND_TO_ROLE, type AgentKind } from '../session/agent-kind';

type Params = {
  readonly step: Step | null;
  readonly kind: AgentKind;
  readonly roleModels: RoleModelPreferences | null;
  readonly agentModel?: string | null;
  readonly agentProvider?: ProviderId | null;
  readonly agentEffort?: EffortLevel | null;
  readonly sessionProvider?: ProviderId | null;
  readonly sessionModel?: string | null;
  readonly sessionEffort?: EffortLevel | null;
  readonly scope?: AutoContext | null;
};

type OfferedParams = {
  readonly provider: ProviderId | null | undefined;
  readonly auto: AutoContext | undefined;
};

const offered = ({ provider, auto }: OfferedParams): ProviderId | null => {
  if (provider == null) {
    return null;
  }
  if (auto === undefined) {
    return provider;
  }
  const standing = providerStanding({ provider, context: auto });
  return standing === 'off' || standing === 'not-connected' ? null : provider;
};

type StepRouting = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: EffortLevel | null;
};

export const resolveStepRouting = ({
  step,
  kind,
  roleModels,
  agentModel,
  agentProvider,
  agentEffort,
  sessionProvider,
  sessionModel,
  sessionEffort,
  scope = null,
}: Params): StepRouting => {
  const auto =
    scope === null
      ? undefined
      : { ...scope, defaultProvider: sessionProvider ?? scope.defaultProvider };
  const fallback = resolveRoleRouting({
    role: KIND_TO_ROLE[kind],
    prefs: roleModels,
    ...(auto !== undefined && { auto }),
  });
  const decided = step?.routingLock?.pick ?? step?.routingDecision?.selected ?? null;
  if (decided !== null) {
    return {
      provider: decided.provider,
      model: decided.model,
      effort: decided.effort,
    };
  }
  const role = step?.role;
  const size = step?.size ?? null;
  const roleRouting =
    role != null
      ? resolveRoleRouting({
          role,
          prefs: roleModels,
          size,
          ...(auto !== undefined && { auto }),
        })
      : null;
  const preference =
    roleRouting ??
    resolveRoleRouting({
      role: KIND_TO_ROLE[kind],
      prefs: roleModels,
      size,
      ...(auto !== undefined && { auto }),
    });
  const preferredProvider = preference.isOverride ? preference.provider : null;
  const spreadProvider = auto?.headroom == null ? null : preference.provider;
  const provider =
    step?.providerOverride ??
    agentProvider ??
    preferredProvider ??
    spreadProvider ??
    offered({ provider: sessionProvider, auto }) ??
    roleRouting?.provider ??
    fallback.provider;
  const roleModel =
    role != null ? recommendedModelForRole({ role, provider, prefs: roleModels, size }) : null;
  const kindModel =
    provider === fallback.provider
      ? fallback.model
      : recommendedModelForRole({ role: KIND_TO_ROLE[kind], provider, prefs: roleModels, size });
  const preferredEffort = preference.isOverride ? preference.effort : null;
  const sessionScopedModel = provider === sessionProvider ? sessionModel : null;
  return {
    provider,
    model: step?.modelOverride ?? agentModel ?? roleModel ?? sessionScopedModel ?? kindModel,
    effort:
      step?.effort ??
      agentEffort ??
      preferredEffort ??
      sessionEffort ??
      roleRouting?.effort ??
      fallback.effort,
  };
};

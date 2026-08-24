import { getCheapModel, recommendedModelForRole, resolveRoleRouting } from '@goodboy/core';
import type { ModelEffort, ProviderId, RoleModelPreferences, Step } from '@goodboy/types';
import { KIND_TO_ROLE, isRightSizedKind, kindRouting, type AgentKind } from '../session/agent-kind';

type Params = {
  readonly step: Step | null;
  readonly kind: AgentKind;
  readonly roleModels: RoleModelPreferences | null;
  readonly agentModel?: string | null;
  readonly agentProvider?: ProviderId | null;
  readonly agentEffort?: ModelEffort | null;
  readonly sessionProvider?: ProviderId | null;
  readonly sessionEffort?: ModelEffort | null;
};

export type StepRouting = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: ModelEffort;
};

export const resolveStepRouting = ({
  step,
  kind,
  roleModels,
  agentModel,
  agentProvider,
  agentEffort,
  sessionProvider,
  sessionEffort,
}: Params): StepRouting => {
  const fallback = kindRouting({ kind, roleModels });
  const role = step?.role;
  const roleRouting = role != null ? resolveRoleRouting({ role, prefs: roleModels }) : null;
  const preference =
    roleRouting ?? resolveRoleRouting({ role: KIND_TO_ROLE[kind], prefs: roleModels });
  const preferredProvider = preference.isOverride ? preference.provider : null;
  const provider =
    step?.providerOverride ??
    agentProvider ??
    preferredProvider ??
    sessionProvider ??
    roleRouting?.provider ??
    fallback.provider;
  const roleModel =
    role != null ? recommendedModelForRole({ role, provider, prefs: roleModels }) : null;
  const kindModel =
    provider === fallback.provider
      ? fallback.model
      : isRightSizedKind({ kind, roleModels })
        ? getCheapModel(provider)
        : recommendedModelForRole({ role: KIND_TO_ROLE[kind], provider, prefs: roleModels });
  const preferredEffort = preference.isOverride ? preference.effort : null;
  return {
    provider,
    model: step?.modelOverride ?? agentModel ?? roleModel ?? kindModel,
    effort:
      step?.effort ??
      agentEffort ??
      preferredEffort ??
      sessionEffort ??
      roleRouting?.effort ??
      fallback.effort,
  };
};

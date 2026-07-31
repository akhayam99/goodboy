import { recommendedModelForRole, resolveRoleRouting } from '@goodboy/core';
import type { ModelEffort, RoleModelPreferences, Step } from '@goodboy/types';
import { kindRouting, type AgentKind } from '../session/agent-kind';

type Params = {
  readonly step: Step | null;
  readonly kind: AgentKind;
  readonly roleModels: RoleModelPreferences | null;
  readonly agentModel?: string | null;
};

export type StepRouting = {
  readonly model: string;
  readonly effort: ModelEffort;
};

export const resolveStepRouting = ({ step, kind, roleModels, agentModel }: Params): StepRouting => {
  const fallback = kindRouting({ kind, roleModels });
  const role = step?.role;
  const roleRouting = role != null ? resolveRoleRouting({ role, prefs: roleModels }) : null;
  const provider = step?.providerOverride ?? roleRouting?.provider ?? fallback.provider;
  const roleModel =
    role != null ? recommendedModelForRole({ role, provider, prefs: roleModels }) : null;
  return {
    model: step?.modelOverride ?? agentModel ?? roleModel ?? fallback.model,
    effort: step?.effort ?? roleRouting?.effort ?? fallback.effort,
  };
};

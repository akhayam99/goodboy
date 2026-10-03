import { resolveRoleRouting, stepSizeForDifficulty } from '@goodboy/core';
import type {
  AgentRole,
  RoleModelPreferences,
  StepSize,
  WorkflowModelPick,
  WorkflowTaskProfile,
} from '@goodboy/types';

type Params = {
  readonly role: AgentRole | null;
  readonly roleModels: RoleModelPreferences | null | undefined;
  readonly size?: StepSize | null;
  readonly profile?: WorkflowTaskProfile | null;
};

export const configuredRolePick = ({
  role,
  roleModels,
  size = null,
  profile = null,
}: Params): WorkflowModelPick | null => {
  if (role === null) {
    return null;
  }
  const routing = resolveRoleRouting({
    role,
    prefs: roleModels,
    size: size ?? (profile === null ? null : stepSizeForDifficulty(profile.difficulty)),
  });
  if (!routing.isOverride) {
    return null;
  }
  return { provider: routing.provider, model: routing.model, effort: routing.effort };
};

import type { AgentEffort, ProviderId, RoleModelPreferences } from '@goodboy/types';
import { PROVIDER_CAPABILITIES } from './capabilities';
import { defaultsForRole, isAgentRole } from '../roles';

export type ResolvedRoleRouting = Readonly<{
  provider: ProviderId;
  model: string;
  effort: AgentEffort;
  isOverride: boolean;
}>;

type Params = {
  readonly role: string;
  readonly prefs: RoleModelPreferences | null | undefined;
};

type LadderParams = {
  readonly ladder: ReadonlyArray<AgentEffort> | null;
  readonly requested: AgentEffort;
  readonly roleDefault: AgentEffort;
};

const effortOnLadder = ({ ladder, requested, roleDefault }: LadderParams): AgentEffort => {
  if (ladder == null) {
    return roleDefault;
  }
  if (ladder.includes(requested)) {
    return requested;
  }
  if (ladder.includes(roleDefault)) {
    return roleDefault;
  }
  return ladder[ladder.length - 1] ?? roleDefault;
};

export const resolveRoleRouting = ({ role, prefs }: Params): ResolvedRoleRouting => {
  const fallback = defaultsForRole(role);
  const compiled: ResolvedRoleRouting = {
    provider: fallback.provider,
    model: fallback.model,
    effort: fallback.effort,
    isOverride: false,
  };
  const preference = prefs?.[isAgentRole(role) ? role : 'custom'];
  if (preference == null) {
    return compiled;
  }
  const descriptor = PROVIDER_CAPABILITIES[preference.providerId]?.models.find(
    (model) => model.id === preference.model,
  );
  if (descriptor == null) {
    return compiled;
  }
  return {
    provider: preference.providerId,
    model: preference.model,
    effort: effortOnLadder({
      ladder: descriptor.effort,
      requested: preference.effort,
      roleDefault: fallback.effort,
    }),
    isOverride: true,
  };
};

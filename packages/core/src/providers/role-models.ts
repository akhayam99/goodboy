import type { AgentEffort, ProviderId, RoleModelPreferences } from '@goodboy/types';
import { PROVIDER_CAPABILITIES } from './capabilities';
import { defaultsForRole, isAgentRole } from '../roles';
import { resolveModelArgs } from './resolveModelArgs';
import { resolveStoredModelSelection } from './resolveStoredModelSelection';

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
  const capabilities = PROVIDER_CAPABILITIES[preference.providerId];
  if (capabilities == null) {
    return compiled;
  }
  const stored = resolveStoredModelSelection({
    provider: preference.providerId,
    id: preference.model,
    effort: preference.effort,
  });
  if (stored.report?.kind === 'unknown') {
    return compiled;
  }
  const resolved = resolveModelArgs({
    provider: preference.providerId,
    selection: stored.selection,
  });
  return {
    provider: preference.providerId,
    model: stored.selection.key,
    effort: resolved.clamped?.applied ?? preference.effort,
    isOverride: true,
  };
};

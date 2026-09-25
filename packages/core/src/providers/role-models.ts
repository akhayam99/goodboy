import type {
  AgentEffort,
  AgentRole,
  ProviderId,
  RoleModelFallback,
  RoleModelPreference,
  RoleModelPreferences,
} from '@goodboy/types';
import { devWarn } from '../dev-log';
import { PROVIDER_CAPABILITIES } from './capabilities';
import { normalizeAgentRole } from '../roles';
import { resolveModelArgs } from './resolveModelArgs';
import { resolvedStoredModelId } from './resolvedStoredModelId';
import { resolveStoredModelSelection } from './resolveStoredModelSelection';
import { resolveAuto, type AutoContext, type AutoStep } from './autoRouting/resolveAuto';

export type ResolvedRoleFallback = Readonly<{
  provider: ProviderId;
  model: string;
  effort: AgentEffort;
}>;

export type PinnedUnavailable = Readonly<{
  provider: ProviderId;
  model: string;
}>;

export type ResolvedRoleRouting = Readonly<{
  provider: ProviderId;
  model: string;
  effort: AgentEffort;
  isOverride: boolean;
  fallback?: ResolvedRoleFallback;
  autoStep?: AutoStep;
  pinnedUnavailable?: PinnedUnavailable;
}>;

type Params = {
  readonly role: string;
  readonly prefs: RoleModelPreferences | null | undefined;
  readonly auto?: AutoContext;
};

const AUTO_ROLE_EFFORT: AgentEffort = 'medium';

const REFERENCE_CONTEXT: AutoContext = { defaultProvider: 'anthropic' };

type FallbackParams = {
  readonly fallback: RoleModelFallback | undefined;
  readonly effort: AgentEffort;
};

const resolveRoleFallback = ({ fallback, effort }: FallbackParams): ResolvedRoleFallback | null => {
  if (fallback == null) {
    return null;
  }
  const capabilities = PROVIDER_CAPABILITIES[fallback.providerId];
  if (capabilities == null) {
    return null;
  }
  const requested = fallback.effort ?? effort;
  const stored = resolveStoredModelSelection({
    provider: fallback.providerId,
    id: fallback.model,
    effort: requested,
  });
  if (stored.report?.kind === 'unknown') {
    return null;
  }
  const resolved = resolveModelArgs({
    provider: fallback.providerId,
    selection: stored.selection,
  });
  return {
    provider: fallback.providerId,
    model: resolvedStoredModelId({
      provider: fallback.providerId,
      selection: stored.selection,
    }),
    effort: resolved.clamped?.applied ?? requested,
  };
};

type AutoRoleParams = {
  readonly role: AgentRole;
  readonly auto: AutoContext;
};

const autoRoleRouting = ({ role, auto }: AutoRoleParams): ResolvedRoleRouting => {
  const pick =
    resolveAuto({ slot: { kind: 'role', id: role }, ...auto }) ??
    resolveAuto({ slot: { kind: 'role', id: role }, ...REFERENCE_CONTEXT });
  if (pick == null) {
    throw new Error(`no curated default for role ${role}`);
  }
  return {
    provider: pick.provider,
    model: pick.model,
    effort: pick.effort ?? AUTO_ROLE_EFFORT,
    isOverride: false,
    autoStep: pick.step,
  };
};

type PinnedParams = {
  readonly role: string;
  readonly preference: RoleModelPreference;
  readonly compiled: ResolvedRoleRouting;
};

const pinnedRoleRouting = ({ role, preference, compiled }: PinnedParams): ResolvedRoleRouting => {
  const capabilities = PROVIDER_CAPABILITIES[preference.providerId];
  if (capabilities == null) {
    devWarn(
      `[role-models] invalid ${role} provider ${preference.providerId}; using the ${compiled.provider} default model`,
    );
    return compiled;
  }
  const stored = resolveStoredModelSelection({
    provider: preference.providerId,
    id: preference.model,
    effort: preference.effort,
  });
  if (stored.report?.kind === 'unknown') {
    devWarn(
      `[role-models] invalid ${role} model ${preference.model} for ${preference.providerId}; using the ${compiled.provider} default model`,
    );
    return compiled;
  }
  const resolved = resolveModelArgs({
    provider: preference.providerId,
    selection: stored.selection,
  });
  const effort = resolved.clamped?.applied ?? preference.effort;
  const fallback = resolveRoleFallback({ fallback: preference.fallback, effort });
  return {
    provider: preference.providerId,
    model: resolvedStoredModelId({
      provider: preference.providerId,
      selection: stored.selection,
    }),
    effort,
    isOverride: true,
    ...(fallback != null && { fallback }),
  };
};

type UsableParams = {
  readonly provider: ProviderId;
  readonly auto: AutoContext | undefined;
};

const isUsable = ({ provider, auto }: UsableParams): boolean =>
  auto?.connected == null || auto.connected.includes(provider);

export const resolveRoleRouting = ({ role, prefs, auto }: Params): ResolvedRoleRouting => {
  const normalizedRole = normalizeAgentRole({ role });
  const compiled = autoRoleRouting({ role: normalizedRole, auto: auto ?? REFERENCE_CONTEXT });
  const preference = prefs?.[normalizedRole];
  if (preference == null) {
    return compiled;
  }
  const pinned = pinnedRoleRouting({ role, preference, compiled });
  if (!pinned.isOverride || isUsable({ provider: pinned.provider, auto })) {
    return pinned;
  }
  const pinnedUnavailable = { provider: pinned.provider, model: pinned.model };
  if (pinned.fallback != null && isUsable({ provider: pinned.fallback.provider, auto })) {
    return { ...pinned.fallback, isOverride: true, pinnedUnavailable };
  }
  return { ...compiled, pinnedUnavailable };
};

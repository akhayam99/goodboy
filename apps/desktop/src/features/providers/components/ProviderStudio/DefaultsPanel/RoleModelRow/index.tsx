import { useEffect, useRef, useState } from 'react';
import {
  PROVIDER_CAPABILITIES,
  clampEffortForModel,
  getModelProvider,
  recommendedModelForRole,
  resolveRoleRouting,
  type AutoContext,
  type ResolvedRoleFallback,
  type ResolvedRoleRouting,
} from '@goodboy/core';
import type {
  AgentRole,
  ProviderId,
  RoleModelFallback,
  RoleModelPreference,
  RoleModelPreferences,
} from '@goodboy/types';
import { RoutingPicker } from '../../../../../../shared/components/RoutingPicker';
import { DefaultRow } from '../DefaultRow';
import { FallbackRow } from '../FallbackRow';

type Props = {
  readonly role: AgentRole;
  readonly label: string;
  readonly help: string;
  readonly preference: RoleModelPreference | null;
  readonly autoContext: AutoContext;
  readonly connectedProviderIds: ReadonlyArray<ProviderId>;
  readonly disabled: boolean;
  readonly onChange: (preference: RoleModelPreference | null) => void;
};

type CommitParams = {
  readonly providerId: ProviderId;
  readonly model: string;
  readonly effort: RoleModelPreference['effort'];
};

type CommitFallbackParams = {
  readonly fallback: RoleModelFallback | null;
};

type StoredFallbackParams = {
  readonly resolved: ResolvedRoleFallback | undefined;
};

type RepairParams = {
  readonly role: AgentRole;
  readonly candidate: RoleModelPreference;
};

const storedFallback = ({ resolved }: StoredFallbackParams): RoleModelFallback | undefined => {
  if (resolved == null) {
    return undefined;
  }
  return { providerId: resolved.provider, model: resolved.model };
};

const repairedRouting = ({ role, candidate }: RepairParams): ResolvedRoleRouting | null => {
  const direct = resolveRoleRouting({ role, prefs: { [role]: candidate } });
  if (direct.isOverride) {
    return direct;
  }
  const owner = getModelProvider(candidate.model);
  if (owner == null || owner === candidate.providerId) {
    return null;
  }
  const repaired = resolveRoleRouting({
    role,
    prefs: { [role]: { ...candidate, providerId: owner } },
  });
  if (!repaired.isOverride) {
    return null;
  }
  return repaired;
};

export const RoleModelRow = ({
  role,
  label,
  help,
  preference,
  autoContext,
  connectedProviderIds,
  disabled,
  onChange,
}: Props) => {
  const compiled = resolveRoleRouting({
    role,
    prefs: null,
    auto: autoContext,
  });
  const prefs: RoleModelPreferences | null = preference == null ? null : { [role]: preference };
  const resolved = resolveRoleRouting({ role, prefs });
  const resolvedProviderId = resolved.isOverride ? resolved.provider : compiled.provider;
  const [providerId, setProviderId] = useState(resolvedProviderId);
  const pendingProvider = useRef(resolvedProviderId);
  const availableProviderIds = connectedProviderIds.filter(
    (candidate) => PROVIDER_CAPABILITIES[candidate].models.length > 0,
  );
  const recommendedModel = recommendedModelForRole({ role, provider: providerId });
  const primaryModel = resolved.isOverride ? resolved.model : recommendedModel;
  const pendingModel = useRef(primaryModel);

  useEffect(() => {
    setProviderId(resolvedProviderId);
    pendingProvider.current = resolvedProviderId;
  }, [resolvedProviderId]);

  useEffect(() => {
    pendingModel.current = primaryModel;
  }, [primaryModel]);

  const commit = ({ providerId: nextProvider, model, effort }: CommitParams) => {
    const carried = storedFallback({ resolved: resolved.fallback });
    const candidate: RoleModelPreference = {
      providerId: nextProvider,
      model,
      effort,
      ...(carried != null && { fallback: carried }),
    };
    const next = repairedRouting({ role, candidate });
    if (next == null) {
      return;
    }
    pendingProvider.current = next.provider;
    pendingModel.current = next.model;
    const kept = storedFallback({ resolved: next.fallback });
    onChange({
      providerId: next.provider,
      model: next.model,
      effort: next.effort,
      ...(kept != null && { fallback: kept }),
    });
  };

  const commitFallback = ({ fallback }: CommitFallbackParams) => {
    const candidate: RoleModelPreference = {
      providerId: resolved.provider,
      model: resolved.model,
      effort: resolved.effort,
      ...(fallback != null && { fallback }),
    };
    const next = repairedRouting({ role, candidate });
    if (next == null) {
      return;
    }
    const kept = storedFallback({ resolved: next.fallback });
    onChange({
      providerId: next.provider,
      model: next.model,
      effort: next.effort,
      ...(kept != null && { fallback: kept }),
    });
  };

  return (
    <DefaultRow label={label} summary={help}>
      <RoutingPicker
        availability="setup"
        ariaLabel={`${label} routing`}
        connectedProviders={availableProviderIds}
        provider={providerId}
        model={resolved.isOverride ? resolved.model : ''}
        effort={{
          editable: true,
          value: resolved.isOverride ? resolved.effort : compiled.effort,
          onChange: (effort) =>
            commit({
              providerId: pendingProvider.current,
              model: pendingModel.current,
              effort,
            }),
        }}
        recommendation={{
          provider: compiled.provider,
          model: compiled.model,
          effort: compiled.effort,
        }}
        recommendationKind="auto"
        overridden={resolved.isOverride}
        onReset={() => onChange(null)}
        resetLabel="Back to Auto"
        align="end"
        disabled={disabled}
        onProvider={(next) => {
          if (next === '') {
            onChange(null);
            return;
          }
          setProviderId(next);
          pendingProvider.current = next;
          const nextModel = recommendedModelForRole({ role, provider: next });
          pendingModel.current = nextModel;
          if (!resolved.isOverride) {
            return;
          }
          commit({
            providerId: next,
            model: nextModel,
            effort:
              clampEffortForModel({ model: nextModel, effort: resolved.effort }) ?? resolved.effort,
          });
        }}
        onModel={(nextModel) => {
          if (nextModel === '') {
            onChange(null);
            return;
          }
          commit({
            providerId: pendingProvider.current,
            model: nextModel,
            effort:
              clampEffortForModel({ model: nextModel, effort: resolved.effort }) ?? resolved.effort,
          });
        }}
        {...(resolved.isOverride && {
          footer: (
            <FallbackRow
              label={label}
              fallback={
                resolved.fallback == null
                  ? null
                  : { provider: resolved.fallback.provider, model: resolved.fallback.model }
              }
              auto={{ provider: compiled.provider, model: compiled.model }}
              effort={resolved.effort}
              connectedProviders={availableProviderIds}
              disabled={disabled}
              onFallback={(fallback) => commitFallback({ fallback })}
            />
          ),
        })}
      />
    </DefaultRow>
  );
};

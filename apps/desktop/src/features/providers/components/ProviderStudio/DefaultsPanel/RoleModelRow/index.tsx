import { useEffect, useRef, useState } from 'react';
import {
  PROVIDER_CAPABILITIES,
  defaultsForRole,
  getModelProvider,
  recommendedModelForRole,
  resolveRoleRouting,
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
import { FieldRow } from '@goodboy/ui';
import {
  EFFORT_LABEL,
  PROVIDER_LABEL,
  clampEffort,
  modelEffortLevels,
  modelLabel,
} from '../../../../../chat/utils/chat-constants';
import { RoutingPicker } from '../../../../../../shared/components/RoutingPicker';
import { RoutingStatusControl } from '../RoutingStatusControl';

const AUTOMATIC_FALLBACK_SUMMARY = 'Automatic';

type Props = {
  readonly role: AgentRole;
  readonly label: string;
  readonly help: string;
  readonly preference: RoleModelPreference | null;
  readonly defaultProviderId: ProviderId;
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
  defaultProviderId,
  connectedProviderIds,
  disabled,
  onChange,
}: Props) => {
  const compiled = defaultsForRole(role);
  const prefs: RoleModelPreferences | null = preference == null ? null : { [role]: preference };
  const resolved = resolveRoleRouting({ role, prefs });
  const resolvedProviderId = resolved.isOverride ? resolved.provider : defaultProviderId;
  const resolvedFallbackProviderId = resolved.fallback?.provider ?? defaultProviderId;
  const [providerId, setProviderId] = useState(resolvedProviderId);
  const [isChoosingFallback, setIsChoosingFallback] = useState(false);
  const pendingProvider = useRef(resolvedProviderId);
  const pendingFallbackProvider = useRef(resolvedFallbackProviderId);
  const availableProviderIds = connectedProviderIds.filter(
    (candidate) => PROVIDER_CAPABILITIES[candidate].models.length > 0,
  );
  const recommendedModel = recommendedModelForRole({ role, provider: providerId });
  const defaultModel = recommendedModelForRole({ role, provider: defaultProviderId });
  const primaryModel = resolved.isOverride ? resolved.model : recommendedModel;
  const pendingModel = useRef(primaryModel);
  const compiledRouting = `${PROVIDER_LABEL[defaultProviderId]} · ${modelLabel(defaultModel)}`;
  const defaultSummary =
    modelEffortLevels(defaultModel) == null
      ? compiledRouting
      : `${compiledRouting} · ${EFFORT_LABEL[compiled.effort]} effort`;
  const isFallbackPickerVisible = resolved.fallback != null || isChoosingFallback;

  useEffect(() => {
    setProviderId(resolvedProviderId);
    pendingProvider.current = resolvedProviderId;
  }, [resolvedProviderId]);

  useEffect(() => {
    pendingModel.current = primaryModel;
  }, [primaryModel]);

  useEffect(() => {
    pendingFallbackProvider.current = resolvedFallbackProviderId;
  }, [resolvedFallbackProviderId]);

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

  const clearFallback = () => {
    setIsChoosingFallback(false);
    commitFallback({ fallback: null });
  };

  return (
    <FieldRow label={label} help={help}>
      <div className="flex items-center gap-2">
        <RoutingStatusControl
          label={label}
          isCustom={resolved.isOverride}
          disabled={disabled}
          onReset={() => onChange(null)}
        />
        <div className="flex w-80 flex-col gap-1">
          <RoutingPicker
            ariaLabel={`${label} routing`}
            connectedProviders={availableProviderIds}
            provider={providerId}
            model={resolved.isOverride ? resolved.model : ''}
            effort={{
              editable: true,
              value: resolved.effort,
              onChange: (effort) =>
                commit({
                  providerId: pendingProvider.current,
                  model: pendingModel.current,
                  effort,
                }),
            }}
            recommendation={{ provider: defaultProviderId, model: recommendedModel }}
            defaultSummary={defaultSummary}
            overridden={resolved.isOverride}
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
                effort: clampEffort(nextModel, resolved.effort),
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
                effort: clampEffort(nextModel, resolved.effort),
              });
            }}
          />
          {resolved.isOverride && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-2xs text-muted-foreground">Fallback</span>
              {isFallbackPickerVisible ? (
                <RoutingPicker
                  variant="pill"
                  align="end"
                  ariaLabel={`${label} fallback routing`}
                  connectedProviders={availableProviderIds}
                  provider={resolved.fallback?.provider ?? resolvedFallbackProviderId}
                  model={resolved.fallback?.model ?? ''}
                  effort={{ editable: false, value: resolved.effort }}
                  defaultSummary={AUTOMATIC_FALLBACK_SUMMARY}
                  overridden={resolved.fallback != null}
                  disabled={disabled}
                  onReset={clearFallback}
                  onProvider={(next) => {
                    if (next === '') {
                      clearFallback();
                      return;
                    }
                    pendingFallbackProvider.current = next;
                  }}
                  onModel={(nextModel) => {
                    if (nextModel === '') {
                      clearFallback();
                      return;
                    }
                    commitFallback({
                      fallback: {
                        providerId: getModelProvider(nextModel) ?? pendingFallbackProvider.current,
                        model: nextModel,
                      },
                    });
                  }}
                />
              ) : (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setIsChoosingFallback(true)}
                  aria-label={`${label} fallback: automatic`}
                  className="rounded-full px-2 py-0.5 text-2xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {AUTOMATIC_FALLBACK_SUMMARY}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </FieldRow>
  );
};

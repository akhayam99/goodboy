import { useEffect, useRef, useState } from 'react';
import { PROVIDER_CAPABILITIES, clampEffortForModel, resolveTaskModel } from '@goodboy/core';
import type { AuxTaskId, EffortLevel, ProviderId, TaskModelPreference } from '@goodboy/types';
import { RoutingPicker } from '../../../../../../shared/components/RoutingPicker';
import { DefaultRow } from '../DefaultRow';
import { FallbackRow, type FallbackChoice } from '../FallbackRow';

const DEFAULT_EFFORT: EffortLevel = 'medium';

type Props = {
  readonly task: AuxTaskId;
  readonly label: string;
  readonly help: string;
  readonly preference: TaskModelPreference | null;
  readonly defaultProviderId: ProviderId;
  readonly fallbackOrder: ReadonlyArray<ProviderId>;
  readonly connectedProviderIds: ReadonlyArray<ProviderId>;
  readonly disabled: boolean;
  readonly onChange: (preference: TaskModelPreference | null) => void;
};

export const TaskModelRow = ({
  task,
  label,
  help,
  preference,
  defaultProviderId,
  fallbackOrder,
  connectedProviderIds,
  disabled,
  onChange,
}: Props) => {
  const automatic = resolveTaskModel({
    task,
    preferences: null,
    workspaceDefaultProviderId: defaultProviderId,
    sessionDefaultProviderId: defaultProviderId,
    connectedProviders: connectedProviderIds,
    fallbackOrder,
  });
  const preferredProviderId = preference?.providerId ?? automatic.providerId;
  const [providerId, setProviderId] = useState(preferredProviderId);
  const pendingProvider = useRef(preferredProviderId);
  const model = preference?.model ?? '';
  const availableProviderIds = connectedProviderIds.filter(
    (candidate) => PROVIDER_CAPABILITIES[candidate].models.length > 0,
  );
  const recommendedModel = resolveTaskModel({
    task,
    preferences: null,
    workspaceDefaultProviderId: providerId,
    sessionDefaultProviderId: defaultProviderId,
  }).model;
  const effortModel = model === '' ? recommendedModel : model;
  const effortValue = preference?.effort ?? automatic.effort ?? DEFAULT_EFFORT;
  const pendingModel = useRef(effortModel);

  useEffect(() => {
    setProviderId(preferredProviderId);
    pendingProvider.current = preferredProviderId;
  }, [preferredProviderId]);

  useEffect(() => {
    pendingModel.current = effortModel;
  }, [effortModel]);

  const withFallback = (next: TaskModelPreference): TaskModelPreference =>
    preference?.fallback == null ? next : { ...next, fallback: preference.fallback };

  const onFallback = (fallback: FallbackChoice | null) => {
    if (preference == null) {
      return;
    }
    const pinned: TaskModelPreference = {
      providerId: preference.providerId,
      model: preference.model,
      ...(preference.effort != null && { effort: preference.effort }),
    };
    onChange(fallback == null ? pinned : { ...pinned, fallback });
  };

  return (
    <DefaultRow label={label} summary={help}>
      <RoutingPicker
        ariaLabel={`${label} routing`}
        connectedProviders={availableProviderIds}
        provider={providerId}
        model={model}
        effort={{
          editable: true,
          value: clampEffortForModel({ model: effortModel, effort: effortValue }) ?? effortValue,
          onChange: (effort) => {
            const applied = clampEffortForModel({ model: pendingModel.current, effort });
            onChange(
              withFallback({
                providerId: pendingProvider.current,
                model: pendingModel.current,
                ...(applied != null && { effort: applied }),
              }),
            );
          },
        }}
        recommendation={{
          provider: automatic.providerId,
          model: automatic.model,
          ...(automatic.effort != null && { effort: automatic.effort }),
        }}
        recommendationKind="auto"
        overridden={preference != null}
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
          const switched = resolveTaskModel({
            task,
            preferences: null,
            workspaceDefaultProviderId: next,
            sessionDefaultProviderId: defaultProviderId,
          });
          pendingModel.current = switched.model;
          if (preference == null) {
            return;
          }
          onChange(withFallback(switched));
        }}
        onModel={(nextModel) => {
          if (nextModel === '') {
            onChange(null);
            return;
          }
          const carried =
            preference?.effort == null
              ? null
              : clampEffortForModel({ model: nextModel, effort: preference.effort });
          pendingModel.current = nextModel;
          onChange(
            withFallback({
              providerId: pendingProvider.current,
              model: nextModel,
              ...(carried != null && { effort: carried }),
            }),
          );
        }}
        {...(preference != null && {
          footer: (
            <FallbackRow
              label={label}
              fallback={
                preference.fallback == null
                  ? null
                  : { provider: preference.fallback.providerId, model: preference.fallback.model }
              }
              auto={{ provider: automatic.providerId, model: automatic.model }}
              effort={effortValue}
              connectedProviders={availableProviderIds}
              disabled={disabled}
              onFallback={onFallback}
            />
          ),
        })}
      />
    </DefaultRow>
  );
};

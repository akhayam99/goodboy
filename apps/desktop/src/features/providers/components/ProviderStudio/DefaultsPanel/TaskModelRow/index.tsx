import { useEffect, useRef, useState } from 'react';
import { PROVIDER_CAPABILITIES, clampEffortForModel, resolveTaskModel } from '@goodboy/core';
import type { AuxTaskId, EffortLevel, ProviderId, TaskModelPreference } from '@goodboy/types';
import { FieldRow } from '@goodboy/ui';
import { RoutingPicker } from '../../../../../../shared/components/RoutingPicker';
import { AUTO_RECOMMENDATION_COPY } from '../../../../../../shared/components/RoutingPicker/autoRecommendationCopy';
import { RoutingStatusControl } from '../RoutingStatusControl';

const DEFAULT_EFFORT: EffortLevel = 'medium';

type Props = {
  readonly task: AuxTaskId;
  readonly label: string;
  readonly help: string;
  readonly preference: TaskModelPreference | null;
  readonly defaultProviderId: ProviderId;
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
  connectedProviderIds,
  disabled,
  onChange,
}: Props) => {
  const automatic = resolveTaskModel({
    task,
    preferences: null,
    workspaceDefaultProviderId: defaultProviderId,
    sessionDefaultProviderId: defaultProviderId,
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
  const effortValue = preference?.effort ?? DEFAULT_EFFORT;
  const pendingModel = useRef(effortModel);

  useEffect(() => {
    setProviderId(preferredProviderId);
    pendingProvider.current = preferredProviderId;
  }, [preferredProviderId]);

  useEffect(() => {
    pendingModel.current = effortModel;
  }, [effortModel]);

  return (
    <FieldRow
      label={label}
      help={help}
      layout="stacked"
      className="@min-[36rem]:flex-row @min-[36rem]:items-center @min-[36rem]:justify-between @min-[36rem]:gap-6"
    >
      <div className="flex min-w-0 items-center gap-2">
        <RoutingStatusControl
          label={label}
          isCustom={preference != null}
          disabled={disabled}
          onReset={() => onChange(null)}
          idleLabel="Auto"
          resetLabel="Back to auto"
        />
        <div className="w-80 min-w-0 max-w-full">
          <RoutingPicker
            ariaLabel={`${label} routing`}
            connectedProviders={availableProviderIds}
            provider={providerId}
            model={model}
            effort={{
              editable: true,
              value:
                clampEffortForModel({ model: effortModel, effort: effortValue }) ?? effortValue,
              onChange: (effort) => {
                const applied = clampEffortForModel({ model: pendingModel.current, effort });
                onChange({
                  providerId: pendingProvider.current,
                  model: pendingModel.current,
                  ...(applied != null && { effort: applied }),
                });
              },
            }}
            recommendation={{
              provider: automatic.providerId,
              model: automatic.model,
              ...AUTO_RECOMMENDATION_COPY,
            }}
            overridden={preference != null}
            disabled={disabled}
            onProvider={(next) => {
              if (next === '') {
                onChange(null);
                return;
              }
              setProviderId(next);
              pendingProvider.current = next;
              pendingModel.current = resolveTaskModel({
                task,
                preferences: null,
                workspaceDefaultProviderId: next,
                sessionDefaultProviderId: defaultProviderId,
              }).model;
              if (preference == null) {
                return;
              }
              onChange(
                resolveTaskModel({
                  task,
                  preferences: null,
                  workspaceDefaultProviderId: next,
                  sessionDefaultProviderId: defaultProviderId,
                }),
              );
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
              onChange({
                providerId: pendingProvider.current,
                model: nextModel,
                ...(carried != null && { effort: carried }),
              });
            }}
          />
        </div>
      </div>
    </FieldRow>
  );
};

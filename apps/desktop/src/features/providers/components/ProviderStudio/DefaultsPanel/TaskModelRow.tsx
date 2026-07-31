import { useEffect, useState } from 'react';
import { PROVIDER_CAPABILITIES, resolveTaskModel } from '@goodboy/core';
import type { AuxTaskId, ModelEffort, ProviderId, TaskModelPreference } from '@goodboy/types';
import { FieldRow } from '@goodboy/ui';
import { clampEffort, modelEffortLevels } from '../../../../chat/utils/chat-constants';
import { RoutingPicker } from '../../../../../shared/components/RoutingPicker';
import { RoutingStatusControl } from './RoutingStatusControl';

const DEFAULT_EFFORT: ModelEffort = 'medium';

const effortForModel = (model: string, requested: ModelEffort): ModelEffort | null =>
  modelEffortLevels(model) == null ? null : clampEffort(model, requested);

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
  const automatic = resolveTaskModel(task, null, defaultProviderId);
  const preferredProviderId = preference?.providerId ?? automatic.providerId;
  const [providerId, setProviderId] = useState(preferredProviderId);
  const model = preference?.model ?? '';
  const availableProviderIds = connectedProviderIds.filter(
    (candidate) => PROVIDER_CAPABILITIES[candidate].models.length > 0,
  );
  const recommendedModel = resolveTaskModel(task, null, providerId).model;
  const effortModel = model === '' ? recommendedModel : model;
  const effortValue = preference?.effort ?? DEFAULT_EFFORT;

  useEffect(() => {
    setProviderId(preferredProviderId);
  }, [preferredProviderId]);

  return (
    <FieldRow label={label} help={help}>
      <div className="flex items-center gap-2">
        <RoutingStatusControl
          label={label}
          isCustom={preference != null}
          disabled={disabled}
          onReset={() => onChange(null)}
        />
        <div className="w-80">
          <RoutingPicker
            ariaLabel={`${label} routing`}
            connectedProviders={availableProviderIds}
            provider={providerId}
            model={model}
            effort={{
              editable: true,
              value: effortForModel(effortModel, effortValue) ?? effortValue,
              onChange: (effort) => {
                const applied = effortForModel(effortModel, effort);
                onChange({
                  providerId,
                  model: model === '' ? recommendedModel : model,
                  ...(applied != null && { effort: applied }),
                });
              },
            }}
            recommendation={{ model: recommendedModel }}
            disabled={disabled}
            onProvider={(next) => {
              if (next === '') {
                return;
              }
              setProviderId(next);
              if (preference == null) {
                return;
              }
              onChange(resolveTaskModel(task, null, next));
            }}
            onModel={(nextModel) => {
              if (nextModel === '') {
                onChange(null);
                return;
              }
              const carried =
                preference?.effort == null ? null : effortForModel(nextModel, preference.effort);
              onChange({
                providerId,
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

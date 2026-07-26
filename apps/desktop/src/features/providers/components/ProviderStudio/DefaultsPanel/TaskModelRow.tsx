import { useEffect, useState } from 'react';
import { PROVIDER_CAPABILITIES, resolveTaskModel } from '@goodboy/core';
import type { AuxTaskId, ProviderId, TaskModelPreference } from '@goodboy/types';
import { FieldRow } from '@goodboy/ui';
import { RoutingPicker } from '../../../../../shared/components/RoutingPicker';

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

  useEffect(() => {
    setProviderId(preferredProviderId);
  }, [preferredProviderId]);

  return (
    <FieldRow label={label} help={help}>
      <div className="w-80">
        <RoutingPicker
          ariaLabel={`${label} routing`}
          connectedProviders={availableProviderIds}
          provider={providerId}
          model={model}
          recommendedModel={recommendedModel}
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
          onModel={(nextModel) =>
            onChange(nextModel === '' ? null : { providerId, model: nextModel })
          }
        />
      </div>
    </FieldRow>
  );
};

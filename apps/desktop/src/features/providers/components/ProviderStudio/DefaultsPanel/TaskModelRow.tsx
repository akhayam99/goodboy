import { useEffect, useState } from 'react';
import { PROVIDER_CAPABILITIES, resolveTaskModel } from '@goodboy/core';
import type { AuxTaskId, ProviderId, TaskModelPreference } from '@goodboy/types';
import { FieldRow, Select } from '@goodboy/ui';
import { PROVIDER_LABEL } from '../../../../chat/utils/chat-constants';
import { ModelSelect } from '../../../../session/components/ModelSelect';

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
      <div className="grid w-80 grid-cols-2 gap-2">
        <Select
          size="sm"
          block
          aria-label={`${label} provider`}
          value={providerId}
          disabled={disabled || availableProviderIds.length === 0}
          onChange={(event) => {
            const nextProviderId = event.target.value as ProviderId;
            setProviderId(nextProviderId);
            if (preference == null) {
              return;
            }
            onChange(resolveTaskModel(task, null, nextProviderId));
          }}
        >
          {availableProviderIds.map((candidate) => (
            <option key={candidate} value={candidate}>
              {PROVIDER_LABEL[candidate]}
            </option>
          ))}
        </Select>
        <ModelSelect
          provider={providerId}
          value={model}
          onChange={(nextModel) =>
            onChange(nextModel === '' ? null : { providerId, model: nextModel })
          }
          disabled={disabled}
          allowAuto
          recommendedModel={recommendedModel}
        />
      </div>
    </FieldRow>
  );
};

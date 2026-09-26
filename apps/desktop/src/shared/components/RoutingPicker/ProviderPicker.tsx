import type { ProviderId } from '@goodboy/types';
import { Listbox } from '@goodboy/ui';
import { PROVIDER_LABEL } from '../../../features/providers/providerLabel';
import { ProviderGlyph } from './ProviderGlyph';
import { ROUTING_PICKER_CONSTANTS } from './constants';

type Props = {
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly provider: ProviderId;
  readonly disabled: boolean;
  readonly onProvider: (provider: ProviderId) => void;
  readonly align?: 'start' | 'end';
  readonly ariaLabel?: string;
};

export const ProviderPicker = ({
  connectedProviders,
  provider,
  disabled,
  onProvider,
  align = 'start',
  ariaLabel = 'provider',
}: Props) => (
  <Listbox
    ariaLabel={ariaLabel}
    size="sm"
    isBlock
    align={align}
    noun="provider"
    searchable={false}
    disabled={disabled}
    value={provider}
    options={ROUTING_PICKER_CONSTANTS.providers.map((id) => ({
      value: id,
      label: PROVIDER_LABEL[id],
      leading: <ProviderGlyph id={id} />,
      disabledReason:
        connectedProviders.includes(id) || id === provider
          ? undefined
          : `${PROVIDER_LABEL[id]} is not connected`,
    }))}
    onChange={onProvider}
  />
);

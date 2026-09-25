import { outdatedCliModels } from '@goodboy/core';
import { SelectableRow, StatusRailItem, type Tone } from '@goodboy/ui';
import { type ProviderConnectionState, type ProviderId } from '@goodboy/types';
import type { ProviderDisplayInfo } from '../../../../features/providers/providers';
import { brandColor, PROVIDER_BRAND } from '../provider-brand';
import { SlidersHorizontal } from 'lucide-react';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';

type Props = {
  readonly providers: ReadonlyArray<ProviderDisplayInfo>;
  readonly focusedId: ProviderId | 'defaults';
  readonly onSelect: (id: ProviderId) => void;
  readonly onSelectDefaults?: () => void;
};

const STATUS_TONE: Record<ProviderConnectionState, Tone> = {
  connected: 'success',
  installed_disconnected: 'warning',
  missing: 'neutral',
  error: 'danger',
  unknown: 'neutral',
};

const STATUS_LABEL: Record<ProviderConnectionState, string> = {
  connected: 'connected',
  installed_disconnected: 'installed',
  missing: 'not installed',
  error: 'error',
  unknown: 'checking',
};

export const ProvidersRail = ({ providers, focusedId, onSelect, onSelectDefaults }: Props) => {
  const learned = useAppStore((state) => state.cliRequirements);
  return (
    <ul aria-label="Providers & models settings" className="flex flex-col gap-0.5 pl-6">
      {onSelectDefaults !== undefined && (
        <li>
          <SelectableRow
            selected={focusedId === 'defaults'}
            onClick={onSelectDefaults}
            ariaCurrent={focusedId === 'defaults'}
            className="items-center gap-2.5 px-2.5 py-2"
          >
            <SlidersHorizontal
              size={ICON_SIZE.control}
              aria-hidden
              className="shrink-0 text-primary"
            />
            <span className="text-sm font-medium text-foreground">Defaults</span>
          </SelectableRow>
        </li>
      )}
      {providers.map((p) => {
        const id = p.id as ProviderId;
        const Icon = PROVIDER_BRAND[id].icon;
        const isOutdated =
          p.connection !== 'missing' &&
          outdatedCliModels({ provider: id, installedVersion: p.version, learned }).length > 0;
        const subtitle = isOutdated
          ? 'update needed'
          : p.connection === 'connected'
            ? (p.identity ?? STATUS_LABEL.connected)
            : STATUS_LABEL[p.connection];
        return (
          <li key={id}>
            <StatusRailItem
              icon={<Icon size={ICON_SIZE.control} style={{ color: brandColor(id) }} />}
              label={p.label}
              subtitle={subtitle}
              tone={isOutdated ? 'warning' : STATUS_TONE[p.connection]}
              selected={id === focusedId}
              onClick={() => onSelect(id)}
            />
          </li>
        );
      })}
    </ul>
  );
};

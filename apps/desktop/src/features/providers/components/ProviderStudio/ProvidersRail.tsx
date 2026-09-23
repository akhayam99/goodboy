import { Eyebrow, SelectableRow, StatusRailItem, type Tone } from '@goodboy/ui';
import { type ProviderConnectionState, type ProviderId } from '@goodboy/types';
import type { ProviderInfo } from '../../../../features/providers/providers';
import { brandColor, PROVIDER_BRAND } from '../provider-brand';
import { SlidersHorizontal } from 'lucide-react';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly providers: ReadonlyArray<ProviderInfo>;
  readonly focusedId: ProviderId | 'defaults';
  readonly onSelect: (id: ProviderId) => void;
  readonly onSelectDefaults: () => void;
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
  return (
    <div className="flex flex-col gap-4 p-2">
      <section className="flex flex-col gap-1">
        <Eyebrow label="Configuration" className="px-2.5" />
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
      </section>
      <section className="flex flex-col gap-1">
        <Eyebrow label="Providers" className="px-2.5" />
        <div className="flex flex-col gap-0.5">
          {providers.map((p) => {
            const id = p.id as ProviderId;
            const Icon = PROVIDER_BRAND[id].icon;
            const active = id === focusedId;
            const subtitle =
              p.connection === 'connected'
                ? (p.identity ?? STATUS_LABEL.connected)
                : STATUS_LABEL[p.connection];
            return (
              <StatusRailItem
                key={id}
                icon={<Icon size={ICON_SIZE.control} style={{ color: brandColor(id) }} />}
                label={p.label}
                subtitle={subtitle}
                tone={STATUS_TONE[p.connection]}
                selected={active}
                onClick={() => onSelect(id)}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
};

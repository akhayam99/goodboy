import { useShallow } from 'zustand/react/shallow';
import { cn, PANE_RHYTHM, SelectableRow, StatusRailItem } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import type { ProviderDisplayInfo } from '../../../../features/providers/providers';
import { brandColor, PROVIDER_BRAND } from '../provider-brand';
import { SlidersHorizontal } from 'lucide-react';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import { providerRailStatus } from '../../providerRailStatus';

type Props = {
  readonly providers: ReadonlyArray<ProviderDisplayInfo>;
  readonly focusedId: ProviderId | 'defaults';
  readonly onSelect: (id: ProviderId) => void;
  readonly onSelectDefaults?: () => void;
};

export const ProvidersRail = ({ providers, focusedId, onSelect, onSelectDefaults }: Props) => {
  const state = useAppStore(useShallow((store) => ({ cliRequirements: store.cliRequirements })));
  return (
    <ul
      aria-label="Providers & models settings"
      className={cn('flex flex-col gap-0.5', PANE_RHYTHM.navRail.nest)}
    >
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
            <span className="text-row text-foreground">Defaults</span>
          </SelectableRow>
        </li>
      )}
      {providers.map((p) => {
        const id = p.id as ProviderId;
        const Icon = PROVIDER_BRAND[id].icon;
        const { subtitle, tone } = providerRailStatus({ provider: p, state });
        return (
          <li key={id}>
            <StatusRailItem
              icon={<Icon size={ICON_SIZE.control} style={{ color: brandColor(id) }} />}
              label={p.label}
              subtitle={subtitle}
              tone={tone}
              selected={id === focusedId}
              onClick={() => onSelect(id)}
            />
          </li>
        );
      })}
    </ul>
  );
};

import { useShallow } from 'zustand/react/shallow';
import type { ProviderId } from '@goodboy/types';
import type { ProviderDisplayInfo } from '../../../../features/providers/providers';
import { brandColor, PROVIDER_BRAND } from '../provider-brand';
import { SlidersHorizontal } from 'lucide-react';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { SettingsNavRow } from '../../../../shared/components/SettingsNavRow';
import { useNow } from '../../../../shared/hooks/useNow';
import { NAMES } from '../../../../shared/names';
import { useAppStore } from '../../../../store';
import { providerRailStatus } from '../../providerRailStatus';

type Props = {
  readonly providers: ReadonlyArray<ProviderDisplayInfo>;
  readonly focusedId: ProviderId | 'defaults';
  readonly onSelect: (id: ProviderId) => void;
  readonly onSelectDefaults?: () => void;
};

const STATUS_CLOCK_MS = 60_000;

export const ProvidersRail = ({ providers, focusedId, onSelect, onSelectDefaults }: Props) => {
  const nowMs = useNow(STATUS_CLOCK_MS);
  const state = useAppStore(
    useShallow((store) => ({
      cliRequirements: store.cliRequirements,
      providerLimits: store.providerLimits,
      providerHealth: store.providerHealth,
    })),
  );
  return (
    <ul aria-label="Providers & models settings" className="flex flex-col gap-0.5">
      {onSelectDefaults !== undefined && (
        <li>
          <SettingsNavRow
            level="page"
            icon={<SlidersHorizontal size={ICON_SIZE.row} aria-hidden className="text-primary" />}
            label={NAMES.models}
            isCurrent={focusedId === 'defaults'}
            onClick={onSelectDefaults}
          />
        </li>
      )}
      {providers.map((p) => {
        const id = p.id as ProviderId;
        const Icon = PROVIDER_BRAND[id].icon;
        const { subtitle, tone } = providerRailStatus({ provider: p, state, nowMs });
        return (
          <li key={id}>
            <SettingsNavRow
              level="page"
              icon={<Icon size={ICON_SIZE.row} style={{ color: brandColor(id) }} />}
              label={p.label}
              isCurrent={id === focusedId}
              status={tone === undefined ? null : { tone, label: subtitle ?? null }}
              onClick={() => onSelect(id)}
            />
          </li>
        );
      })}
    </ul>
  );
};

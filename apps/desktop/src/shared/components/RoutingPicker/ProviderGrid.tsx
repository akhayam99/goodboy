import { Plus } from 'lucide-react';
import type { ProviderId } from '@goodboy/types';
import { cn, ICON_SIZE, Tooltip } from '@goodboy/ui';
import { PROVIDER_LABEL } from '../../../features/providers/providerLabel';
import { ProviderGlyph } from './ProviderGlyph';
import { ROUTING_PICKER_CONSTANTS } from './constants';
import { openSettings } from '../../../features/settings/openSettings';

type Props = {
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly activeProvider: ProviderId | null;
  readonly secondaryProvider?: ProviderId | null;
  readonly disableDisconnected?: boolean;
  readonly showDisconnected?: boolean;
  readonly onSelect: (provider: ProviderId) => void;
  readonly onNavigateProviders?: () => void;
};

export const ProviderGrid = ({
  connectedProviders,
  activeProvider,
  secondaryProvider = null,
  disableDisconnected = false,
  showDisconnected = false,
  onSelect,
  onNavigateProviders,
}: Props) => (
  <div className={ROUTING_PICKER_CONSTANTS.providerChipGroupClassName}>
    <div className={ROUTING_PICKER_CONSTANTS.providerGlyphsClassName}>
      {ROUTING_PICKER_CONSTANTS.providers
        .filter(
          (id) =>
            showDisconnected ||
            connectedProviders.includes(id) ||
            id === activeProvider ||
            id === secondaryProvider,
        )
        .map((id) => {
          const isConnected = connectedProviders.includes(id);
          const isActive = activeProvider === id;
          const isSecondary = secondaryProvider === id;
          const isDisabled = disableDisconnected && !isConnected;
          return (
            <Tooltip
              key={id}
              content={isConnected ? PROVIDER_LABEL[id] : `${PROVIDER_LABEL[id]} is not connected`}
            >
              <button
                type="button"
                aria-label={PROVIDER_LABEL[id]}
                aria-pressed={isActive}
                disabled={isDisabled}
                onClick={() => onSelect(id)}
                className={cn(
                  'relative inline-flex size-full min-w-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground',
                  isActive && 'bg-background text-foreground shadow-sm',
                  isSecondary && 'text-foreground ring-1 ring-inset ring-border-soft',
                  isDisabled && 'cursor-not-allowed',
                )}
              >
                <span className={cn(!isConnected && 'opacity-35')}>
                  <ProviderGlyph id={id} size={ICON_SIZE.control} />
                </span>
                {!isConnected ? (
                  <span
                    className="absolute right-1 top-1 size-1.5 rounded-full bg-warning ring-1 ring-subtle"
                    aria-hidden
                  />
                ) : null}
              </button>
            </Tooltip>
          );
        })}
    </div>
    {onNavigateProviders != null && (
      <Tooltip content="Add provider" anchorClassName="h-7 shrink-0">
        <button
          type="button"
          aria-label="Add provider"
          onClick={() => {
            onNavigateProviders();
            openSettings({ scope: 'providers' });
          }}
          className="inline-flex h-full shrink-0 items-center justify-center gap-1 rounded-md px-2 text-chip font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <Plus size={ICON_SIZE.control} aria-hidden className="shrink-0" />
          <span>Add</span>
        </button>
      </Tooltip>
    )}
  </div>
);

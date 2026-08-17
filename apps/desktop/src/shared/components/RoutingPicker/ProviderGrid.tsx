import type { ProviderId } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { PROVIDER_LABEL } from '../../../features/chat/utils/chat-constants';
import { ProviderGlyph } from './ProviderGlyph';
import { ROUTING_PICKER_CONSTANTS } from './constants';

type Props = {
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly activeProvider: ProviderId | null;
  readonly secondaryProvider?: ProviderId | null;
  readonly disableDisconnected?: boolean;
  readonly onSelect: (provider: ProviderId) => void;
};

export const ProviderGrid = ({
  connectedProviders,
  activeProvider,
  secondaryProvider = null,
  disableDisconnected = false,
  onSelect,
}: Props) => (
  <div className={ROUTING_PICKER_CONSTANTS.providerChipGroupClassName}>
    {ROUTING_PICKER_CONSTANTS.providers
      .filter(
        (id) =>
          connectedProviders.includes(id) || id === activeProvider || id === secondaryProvider,
      )
      .map((id) => {
        const isConnected = connectedProviders.includes(id);
        const isActive = activeProvider === id;
        const isSecondary = secondaryProvider === id;
        const isDisabled = disableDisconnected && !isConnected;
        return (
          <button
            key={id}
            type="button"
            title={isConnected ? PROVIDER_LABEL[id] : `${PROVIDER_LABEL[id]} is not connected`}
            aria-label={isConnected ? PROVIDER_LABEL[id] : `${PROVIDER_LABEL[id]}, disconnected`}
            aria-pressed={isActive}
            disabled={isDisabled}
            onClick={() => onSelect(id)}
            className={cn(
              'relative inline-flex min-w-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground',
              isActive && 'bg-background text-foreground shadow-sm',
              isSecondary && 'text-foreground ring-1 ring-inset ring-border-soft',
              isDisabled && 'cursor-not-allowed',
            )}
          >
            <span className={cn(!isConnected && 'opacity-35')}>
              <ProviderGlyph id={id} size={15} />
            </span>
            {!isConnected ? (
              <span
                className="absolute right-1 top-1 size-1.5 rounded-full bg-warning ring-1 ring-subtle"
                aria-hidden
              />
            ) : null}
          </button>
        );
      })}
  </div>
);

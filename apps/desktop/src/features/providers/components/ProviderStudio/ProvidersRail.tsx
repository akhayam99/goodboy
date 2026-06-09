import { cn } from '@goodboy/ui';
import type { ProviderConnectionState, ProviderId } from '@goodboy/types';
import type { ProviderInfo } from '../../../../features/providers/providers';
import { brandColor, PROVIDER_BRAND } from '../provider-brand';

type Props = {
  readonly providers: ReadonlyArray<ProviderInfo>;
  readonly focusedId: ProviderId | null;
  readonly onSelect: (id: ProviderId) => void;
};

const STATUS_DOT: Record<ProviderConnectionState, string> = {
  connected: 'bg-success',
  installed_disconnected: 'bg-warning',
  missing: 'bg-muted-foreground/40',
  error: 'bg-danger',
};

const STATUS_LABEL: Record<ProviderConnectionState, string> = {
  connected: 'connected',
  installed_disconnected: 'installed',
  missing: 'not installed',
  error: 'error',
};

export const ProvidersRail = ({ providers, focusedId, onSelect }: Props) => {
  return (
    <div className="flex flex-col gap-0.5 p-2">
      {providers.map((p) => {
        const id = p.id as ProviderId;
        const Icon = PROVIDER_BRAND[id].icon;
        const active = id === focusedId;
        const subtitle =
          p.connection === 'connected'
            ? (p.identity ?? STATUS_LABEL.connected)
            : STATUS_LABEL[p.connection];
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            aria-current={active}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors',
              active
                ? 'bg-primary/10 text-foreground ring-1 ring-primary/30'
                : 'text-muted-foreground hover:bg-muted/50',
            )}
          >
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-md"
              style={{
                backgroundColor: `color-mix(in oklch, ${brandColor(id)} 18%, transparent)`,
                color: brandColor(id),
              }}
            >
              <Icon size={15} aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium lowercase text-foreground">
                {p.label}
              </span>
              <span className="truncate text-2xs text-muted-foreground">{subtitle}</span>
            </span>
            <span
              className={cn('size-2 shrink-0 rounded-full', STATUS_DOT[p.connection])}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
};

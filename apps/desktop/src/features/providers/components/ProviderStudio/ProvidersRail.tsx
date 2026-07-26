import { cn, IconTile } from '@goodboy/ui';
import type { ProviderConnectionState, ProviderId } from '@goodboy/types';
import type { ProviderInfo } from '../../../../features/providers/providers';
import { brandColor, PROVIDER_BRAND } from '../provider-brand';
import { SlidersHorizontal } from 'lucide-react';

type Props = {
  readonly providers: ReadonlyArray<ProviderInfo>;
  readonly focusedId: ProviderId | 'defaults';
  readonly onSelect: (id: ProviderId) => void;
  readonly onSelectDefaults: () => void;
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

export const ProvidersRail = ({ providers, focusedId, onSelect, onSelectDefaults }: Props) => {
  return (
    <div className="flex flex-col gap-4 p-2">
      <section className="flex flex-col gap-1">
        <span className="px-2.5 text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Configuration
        </span>
        <button
          type="button"
          onClick={onSelectDefaults}
          aria-current={focusedId === 'defaults'}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors',
            focusedId === 'defaults'
              ? 'bg-primary/10 text-foreground ring-1 ring-primary/30'
              : 'text-muted-foreground hover:bg-muted/50',
          )}
        >
          <IconTile size="sm" tone="primary" ring={false}>
            <SlidersHorizontal size={15} aria-hidden />
          </IconTile>
          <span className="text-sm font-medium text-foreground">Defaults</span>
        </button>
      </section>
      <section className="flex flex-col gap-1">
        <span className="px-2.5 text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Providers
        </span>
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
                <IconTile size="sm" color={brandColor(id)}>
                  <Icon size={15} aria-hidden />
                </IconTile>
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
      </section>
    </div>
  );
};

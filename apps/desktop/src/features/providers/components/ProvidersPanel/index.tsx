import { useState } from 'react';
import { Code2, Info, MousePointer2, RotateCw, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Tooltip, cn } from '@kay-am/ui';
import type {
  ProviderConnectionState,
  ProviderInfo,
} from '../../../../features/providers/providers';
import { providerAction } from '../../../../features/providers/providers';
import type { ProviderId } from '../../../../features/providers/providers';
import { useAppStore } from '../../../../store';
import { openUrl } from '../../../../shared/lib/editor';

const STATE_LABEL: Record<ProviderConnectionState, string> = {
  connected: 'Connected',
  installed_disconnected: 'Not logged in',
  missing: 'Not installed',
  error: 'Error',
};

const STATE_DOT: Record<ProviderConnectionState, string> = {
  connected: 'bg-primary',
  installed_disconnected: 'bg-warning',
  missing: 'bg-muted-foreground/40',
  error: 'bg-danger',
};

const PROVIDER_ORDER: ProviderId[] = ['anthropic', 'cursor', 'codex'];

interface ProviderBrand {
  readonly name: string;
  readonly description: string;
  readonly icon: LucideIcon;
  readonly cssVar: string;
}

const PROVIDER_BRAND: Record<ProviderId, ProviderBrand> = {
  anthropic: {
    name: 'claude',
    description: 'anthropic claude code cli',
    icon: Sparkles,
    cssVar: '--color-provider-anthropic',
  },
  cursor: {
    name: 'cursor',
    description: 'cursor agent cli',
    icon: MousePointer2,
    cssVar: '--color-provider-cursor',
  },
  codex: {
    name: 'codex',
    description: 'openai codex cli',
    icon: Code2,
    cssVar: '--color-provider-codex',
  },
};

export function ProvidersPanel() {
  const providers = useAppStore((s) => s.providers);
  const refreshProviders = useAppStore((s) => s.refreshProviders);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshProviders();
    } finally {
      setRefreshing(false);
    }
  };

  const ordered = PROVIDER_ORDER.map((id) => providers.find((p) => p.id === id)).filter(
    (p): p is ProviderInfo => p !== undefined,
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-foreground">Providers</div>
        <Tooltip content="Re-detect installed CLIs" side="top">
          <button
            type="button"
            aria-label="Re-detect installed CLIs"
            disabled={refreshing}
            onClick={() => void onRefresh()}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <RotateCw size={14} className={refreshing ? 'animate-spin' : undefined} aria-hidden />
          </button>
        </Tooltip>
      </div>
      {ordered.length === 0 ? (
        <p className="text-2xs text-muted-foreground">No providers configured</p>
      ) : (
        <div className="grid grid-cols-3 gap-2.5">
          {ordered.map((p) => (
            <ProviderTile key={p.id} info={p} onRefresh={onRefresh} />
          ))}
        </div>
      )}
      <div className="flex items-start gap-1.5 text-2xs text-muted-foreground">
        <Info size={11} aria-hidden className="mt-0.5 shrink-0" />
        <span>
          Sign in once via each provider's CLI (e.g. run{' '}
          <code className="rounded bg-muted px-1">claude</code> in a terminal). kay-am picks up the
          credentials.
        </span>
      </div>
    </div>
  );
}

function ProviderTile({ info, onRefresh }: { info: ProviderInfo; onRefresh: () => Promise<void> }) {
  const brand = PROVIDER_BRAND[info.id as ProviderId];
  const Icon = brand?.icon ?? Sparkles;
  const connected = info.connection === 'connected';
  const errored = info.connection === 'error';
  const dim = !connected && !errored;
  const color = brand ? `var(${brand.cssVar})` : 'var(--color-primary)';

  return (
    <div
      className="relative flex flex-col items-center gap-2 rounded-lg border bg-subtle p-3 shadow-sm transition-colors"
      style={{
        borderColor: `color-mix(in oklch, ${color} 25%, var(--color-border-soft))`,
      }}
    >
      {info.connection !== 'connected' ? (
        <Tooltip content={STATE_LABEL[info.connection]} side="top">
          <span
            aria-hidden
            className={cn(
              'absolute left-2.5 top-2.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full',
              STATE_DOT[info.connection],
            )}
          />
        </Tooltip>
      ) : null}

      <div
        aria-hidden
        className={cn(
          'mt-1 flex h-10 w-10 items-center justify-center rounded-full transition-opacity',
          dim && 'opacity-50',
        )}
        style={{
          backgroundColor: `color-mix(in oklch, ${color} 18%, transparent)`,
          color,
        }}
      >
        <Icon size={18} strokeWidth={2} />
      </div>

      <div className="flex flex-col items-center gap-0.5">
        <span className="text-sm font-semibold lowercase">{brand?.name ?? info.label}</span>
        <span className="text-2xs text-muted-foreground">
          {info.version ?? brand?.description ?? info.binary}
        </span>
      </div>

      <TileStatus info={info} />

      <div className="mt-1 w-full">
        <TileAction info={info} onRefresh={onRefresh} />
      </div>
    </div>
  );
}

function TileStatus({ info }: { info: ProviderInfo }) {
  if (info.connection === 'connected') {
    return (
      <div
        className="max-w-full truncate text-2xs text-muted-foreground"
        title={info.identity ?? ''}
      >
        {info.identity ?? 'No identity found'}
      </div>
    );
  }
  if (info.connection === 'error') {
    return (
      <div className="line-clamp-2 text-center text-2xs text-danger" title={info.error ?? ''}>
        {info.error ?? 'unknown error'}
      </div>
    );
  }
  return <div className="text-2xs text-muted-foreground">{STATE_LABEL[info.connection]}</div>;
}

function TileAction({ info, onRefresh }: { info: ProviderInfo; onRefresh: () => Promise<void> }) {
  const [pending, setPending] = useState<'login' | 'logout' | null>(null);

  const onAction = async (action: 'login' | 'logout') => {
    setPending(action);
    try {
      await providerAction(info.id as ProviderId, action);
    } catch {
      // terminal launch failed — surface as no-op; user can retry
    }
  };

  if (info.connection === 'missing') {
    return (
      <button
        type="button"
        className="block w-full rounded-md border border-border-soft py-1.5 text-center text-xs text-primary hover:bg-muted"
        onClick={() => void openUrl(info.docsUrl)}
      >
        Install ↗
      </button>
    );
  }

  if (info.connection === 'error') {
    return (
      <button
        type="button"
        className="block w-full rounded-md border border-border-soft py-1.5 text-center text-xs hover:bg-muted"
        onClick={() => void onRefresh()}
      >
        Retry
      </button>
    );
  }

  if (info.connection === 'installed_disconnected') {
    return (
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          className="w-full rounded-md border border-border-soft py-1.5 text-center text-xs text-primary hover:bg-muted disabled:opacity-50"
          disabled={pending === 'login'}
          onClick={() => void onAction('login')}
        >
          Connect ↗
        </button>
        {pending === 'login' ? (
          <span className="text-center text-2xs text-muted-foreground">
            Complete in terminal, then{' '}
            <button
              type="button"
              className="underline hover:text-foreground"
              onClick={() => void onRefresh()}
            >
              Refresh ↻
            </button>
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex w-full items-stretch gap-1.5">
        <Tooltip content="Re-check identity" side="top">
          <button
            type="button"
            aria-label="Re-check identity"
            className="rounded-md border border-border-soft px-2 text-xs hover:bg-muted"
            onClick={() => void onRefresh()}
          >
            ↻
          </button>
        </Tooltip>
        <button
          type="button"
          className="flex-1 rounded-md border border-border-soft py-1.5 text-center text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          disabled={pending === 'logout'}
          onClick={() => void onAction('logout')}
        >
          Disconnect ↗
        </button>
      </div>
      {pending === 'logout' ? (
        <span className="text-center text-2xs text-muted-foreground">
          Complete in terminal, then{' '}
          <button
            type="button"
            className="underline hover:text-foreground"
            onClick={() => void onRefresh()}
          >
            Refresh ↻
          </button>
        </span>
      ) : null}
    </div>
  );
}

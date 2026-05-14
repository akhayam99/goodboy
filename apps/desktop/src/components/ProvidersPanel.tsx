import { useState } from 'react';
import { Code2, Info, MousePointer2, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button, Tooltip, cn } from '@kay-am/ui';
import type { ProviderConnectionState, ProviderInfo } from '../providers';
import { providerAction } from '../providers';
import type { ProviderId } from '../providers';
import { useAppStore } from '../store';
import { openUrl } from '../editor';

const STATE_LABEL: Record<ProviderConnectionState, string> = {
  connected: 'connected',
  installed_disconnected: 'not logged in',
  missing: 'not installed',
  error: 'error',
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
        <div className="text-xs font-semibold text-foreground">providers</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void onRefresh()}
          disabled={refreshing}
          title="re-detect installed CLIs"
        >
          {refreshing ? 'refreshing…' : 'refresh all'}
        </Button>
      </div>
      {ordered.length === 0 ? (
        <p className="text-2xs text-muted-foreground">no providers configured</p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {ordered.map((p) => (
            <ProviderTile key={p.id} info={p} onRefresh={onRefresh} />
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        kay-am orchestrates via each provider's CLI. login is handled by the CLI itself (e.g. run{' '}
        <code className="rounded bg-muted px-1">claude</code> in a terminal once).
      </p>
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
      className="relative flex min-h-[200px] flex-col items-center gap-2.5 overflow-hidden rounded-lg border bg-subtle p-4 shadow-sm transition-colors"
      style={{
        borderColor: `color-mix(in oklch, ${color} 25%, var(--color-border-soft))`,
      }}
    >
      <Tooltip content={STATE_LABEL[info.connection]} side="top">
        <span
          aria-hidden
          className={cn(
            'absolute left-3 top-3 inline-block h-2 w-2 shrink-0 rounded-full',
            STATE_DOT[info.connection],
          )}
        />
      </Tooltip>
      <TileCaveat info={info} />

      <div
        aria-hidden
        className={cn(
          'mt-2 flex h-14 w-14 items-center justify-center rounded-full transition-opacity',
          dim && 'opacity-50',
        )}
        style={{
          backgroundColor: `color-mix(in oklch, ${color} 18%, transparent)`,
          color,
        }}
      >
        <Icon size={26} strokeWidth={2} />
      </div>

      <div className="flex flex-col items-center gap-0.5">
        <span className="text-sm font-semibold lowercase">{brand?.name ?? info.label}</span>
        <span className="text-2xs text-muted-foreground">
          {info.version ?? brand?.description ?? info.binary}
        </span>
      </div>

      <TileStatus info={info} />

      <div className="mt-auto w-full">
        <TileAction info={info} onRefresh={onRefresh} />
      </div>
    </div>
  );
}

function TileCaveat({ info }: { info: ProviderInfo }) {
  const caveats: string[] = [];
  if (info.id !== 'anthropic') {
    caveats.push('permission proxy not supported');
  }
  if (info.connection === 'connected') {
    caveats.push(
      info.id === 'anthropic'
        ? 'quota info unavailable (anthropic does not expose it via the cli)'
        : 'quota info unavailable',
    );
  }
  if (caveats.length === 0) return null;

  return (
    <Tooltip content={caveats.join(' · ')} side="top">
      <span className="absolute right-3 top-3 inline-flex cursor-default text-muted-foreground/70">
        <Info size={12} aria-hidden />
      </span>
    </Tooltip>
  );
}

function TileStatus({ info }: { info: ProviderInfo }) {
  if (info.connection === 'connected') {
    return (
      <div
        className="max-w-full truncate text-2xs text-muted-foreground"
        title={info.identity ?? ''}
      >
        {info.identity ?? 'no identity reported'}
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
        install ↗
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
        retry
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
          connect ↗
        </button>
        {pending === 'login' ? (
          <span className="text-center text-2xs text-muted-foreground">
            complete in terminal, then{' '}
            <button
              type="button"
              className="underline hover:text-foreground"
              onClick={() => void onRefresh()}
            >
              refresh ↻
            </button>
          </span>
        ) : null}
      </div>
    );
  }

  // connected
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex w-full items-stretch gap-1.5">
        <Tooltip content="re-check identity" side="top">
          <button
            type="button"
            aria-label="re-check identity"
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
          disconnect ↗
        </button>
      </div>
      {pending === 'logout' ? (
        <span className="text-center text-2xs text-muted-foreground">
          complete in terminal, then{' '}
          <button
            type="button"
            className="underline hover:text-foreground"
            onClick={() => void onRefresh()}
          >
            refresh ↻
          </button>
        </span>
      ) : null}
    </div>
  );
}

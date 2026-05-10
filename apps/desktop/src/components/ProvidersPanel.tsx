import { useState } from 'react';
import { Button, Tooltip, cn } from '@kay-am/ui';
import type { ProviderConnectionState, ProviderInfo } from '../providers';
import { providerAction } from '../providers';
import type { ProviderId } from '../providers';
import { useAppStore } from '../store';
import { openUrl } from '../editor';

const STATE_LABEL: Record<ProviderConnectionState, string> = {
  connected: 'connected',
  installed_disconnected: 'installed, not logged in',
  missing: 'not installed',
  error: 'error',
};

const STATE_DOT: Record<ProviderConnectionState, string> = {
  connected: 'bg-primary',
  installed_disconnected: 'bg-warning',
  missing: 'bg-muted-foreground/40',
  error: 'bg-danger',
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
      {providers.length === 0 ? (
        <p className="text-2xs text-muted-foreground">no providers configured</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-soft overflow-hidden rounded-md border border-border-soft bg-subtle shadow-sm">
          {providers.map((p) => (
            <ProviderRow key={p.id} info={p} onRefresh={onRefresh} />
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        kay-am orchestrates via each provider's CLI. login is handled by the CLI itself (e.g. run{' '}
        <code className="rounded bg-muted px-1">claude</code> in a terminal once).
      </p>
    </div>
  );
}

function ProviderRow({ info, onRefresh }: { info: ProviderInfo; onRefresh: () => Promise<void> }) {
  return (
    <li className="flex items-center gap-3 px-3 py-2.5 text-xs">
      <span
        aria-hidden
        className={cn('inline-block h-2 w-2 shrink-0 rounded-full', STATE_DOT[info.connection])}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="font-medium">{info.label}</span>
          <code className="text-2xs text-muted-foreground">{info.binary}</code>
          {info.version ? (
            <span className="rounded bg-muted px-1 text-2xs text-muted-foreground">
              {info.version}
            </span>
          ) : null}
          {info.id !== 'anthropic' ? (
            <span
              className="rounded bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground"
              title="permission proxy currently covers claude only. cursor and codex run with their CLI defaults; coverage is tracked for a future milestone."
            >
              permission proxy: not supported
            </span>
          ) : null}
        </div>
        <RowStatus info={info} />
      </div>
      <RowActions info={info} onRefresh={onRefresh} />
    </li>
  );
}

function RowStatus({ info }: { info: ProviderInfo }) {
  if (info.connection === 'connected') {
    return (
      <div className="text-xs text-muted-foreground">{info.identity ?? 'no identity reported'}</div>
    );
  }
  if (info.connection === 'error') {
    return (
      <div className="text-xs">
        <span className="text-danger">{info.error ?? 'unknown error'}</span>
      </div>
    );
  }
  return <div className="text-xs text-muted-foreground">{STATE_LABEL[info.connection]}</div>;
}

function RowActions({ info, onRefresh }: { info: ProviderInfo; onRefresh: () => Promise<void> }) {
  const [pending, setPending] = useState<'login' | 'logout' | null>(null);

  const onAction = async (action: 'login' | 'logout') => {
    setPending(action);
    try {
      await providerAction(info.id as ProviderId, action);
    } catch {
      // terminal launch failed — fall through to show note anyway
    }
  };

  if (info.connection === 'missing') {
    return (
      <button
        type="button"
        className="shrink-0 text-xs text-primary underline hover:opacity-80"
        onClick={() => void openUrl(info.docsUrl)}
      >
        install ↗
      </button>
    );
  }

  if (info.connection === 'error') {
    return (
      <Button variant="ghost" size="sm" className="shrink-0" onClick={() => void onRefresh()}>
        retry
      </Button>
    );
  }

  if (info.connection === 'installed_disconnected') {
    return (
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <button
          type="button"
          className="text-xs text-primary underline hover:opacity-80 disabled:opacity-50"
          disabled={pending === 'login'}
          onClick={() => void onAction('login')}
        >
          connect ↗
        </button>
        {pending === 'login' ? (
          <span className="text-2xs text-muted-foreground">
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

  if (info.connection === 'connected') {
    return (
      <div className="flex shrink-0 items-center gap-1">
        <Tooltip content="re-check identity" side="top">
          <Button
            variant="ghost"
            size="sm"
            aria-label="re-check identity"
            onClick={() => void onRefresh()}
          >
            ↻
          </Button>
        </Tooltip>
        <div className="flex flex-col items-end gap-0.5">
          <button
            type="button"
            className="text-xs text-muted-foreground underline hover:text-foreground disabled:opacity-50"
            disabled={pending === 'logout'}
            onClick={() => void onAction('logout')}
          >
            disconnect ↗
          </button>
          {pending === 'logout' ? (
            <span className="text-2xs text-muted-foreground">
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
      </div>
    );
  }

  return null;
}

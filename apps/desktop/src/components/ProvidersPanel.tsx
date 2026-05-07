import { useState } from 'react';
import { Button, cn } from '@kay-am/ui';
import type { ProviderConnectionState, ProviderInfo } from '../providers';
import { providerAction } from '../providers';
import type { ProviderId } from '../providers';
import { useAppStore } from '../store';

const STATE_LABEL: Record<ProviderConnectionState, string> = {
  connected: 'connected',
  installed_disconnected: 'installed, not logged in',
  missing: 'not installed',
  error: 'error',
  'coming-soon': 'integration in v0.2',
};

const STATE_DOT: Record<ProviderConnectionState, string> = {
  connected: 'bg-primary',
  installed_disconnected: 'bg-warning',
  missing: 'bg-danger',
  error: 'bg-danger',
  'coming-soon': 'bg-muted-foreground/40',
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
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground">providers</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void onRefresh()}
          disabled={refreshing}
          title="re-detect installed CLIs"
        >
          {refreshing ? 'refreshing…' : 'refresh'}
        </Button>
      </div>
      <ul className="flex flex-col divide-y divide-border rounded border border-border">
        {providers.map((p) => (
          <ProviderRow key={p.id} info={p} onRefresh={onRefresh} />
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground">
        kay-am orchestrates via each provider's CLI. login is handled by the CLI itself (e.g. run{' '}
        <code className="rounded bg-muted px-1">claude</code> in a terminal once).
      </p>
    </div>
  );
}

function ProviderRow({ info, onRefresh }: { info: ProviderInfo; onRefresh: () => Promise<void> }) {
  const placeholder = info.connection === 'coming-soon';
  return (
    <li
      className={cn('flex items-center gap-3 px-3 py-2 text-xs', placeholder ? 'opacity-60' : '')}
    >
      <span
        aria-hidden
        className={cn('inline-block h-2 w-2 rounded-full', STATE_DOT[info.connection])}
      />
      <div className="flex flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="font-medium">{info.label}</span>
          <code className="text-[10px] text-muted-foreground">{info.binary}</code>
          {info.version ? (
            <span className="text-[10px] text-muted-foreground">{info.version}</span>
          ) : null}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {STATE_LABEL[info.connection]}
          {info.error ? <span className="text-danger"> — {info.error}</span> : null}
        </div>
      </div>
      <RowActions info={info} onRefresh={onRefresh} />
    </li>
  );
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

  if (info.connection === 'coming-soon') {
    return info.trackingIssueUrl ? (
      <a
        href={info.trackingIssueUrl}
        target="_blank"
        rel="noreferrer"
        className="text-[11px] text-muted-foreground underline hover:text-foreground"
      >
        track ↗
      </a>
    ) : null;
  }

  if (info.connection === 'missing') {
    return (
      <a
        href={info.docsUrl}
        target="_blank"
        rel="noreferrer"
        className="text-[11px] text-primary underline hover:opacity-80"
      >
        install ↗
      </a>
    );
  }

  if (info.connection === 'error') {
    return (
      <Button variant="ghost" size="sm" onClick={() => void onRefresh()}>
        retry
      </Button>
    );
  }

  if (info.connection === 'installed_disconnected') {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          disabled={pending === 'login'}
          onClick={() => void onAction('login')}
        >
          connect
        </Button>
        {pending === 'login' ? (
          <span className="text-[10px] text-muted-foreground">
            complete in terminal, then{' '}
            <button className="underline hover:text-foreground" onClick={() => void onRefresh()}>
              refresh ↻
            </button>
          </span>
        ) : null}
      </div>
    );
  }

  if (info.connection === 'connected') {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          disabled={pending === 'logout'}
          onClick={() => void onAction('logout')}
        >
          disconnect
        </Button>
        {pending === 'logout' ? (
          <span className="text-[10px] text-muted-foreground">
            complete in terminal, then{' '}
            <button className="underline hover:text-foreground" onClick={() => void onRefresh()}>
              refresh ↻
            </button>
          </span>
        ) : null}
      </div>
    );
  }

  return null;
}

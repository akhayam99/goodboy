import { useState } from 'react';
import { Info, RotateCw } from 'lucide-react';
import { Tooltip } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import type { ProviderInfo } from '../../../../features/providers/providers';
import { useAppStore } from '../../../../store';
import { ProviderLifecycleTile } from '../ProviderLifecycleTile';

const PROVIDER_ORDER: ProviderId[] = ['anthropic', 'cursor', 'codex', 'gemini'];

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
        <div className="grid grid-cols-2 gap-2.5">
          {ordered.map((p) => (
            <ProviderLifecycleTile key={p.id} info={p} />
          ))}
        </div>
      )}
      <div className="flex items-start gap-1.5 text-2xs text-muted-foreground">
        <Info size={11} aria-hidden className="mt-0.5 shrink-0" />
        <span>
          Install and sign in straight from Goodboy. Every step runs in a roomy modal with the
          embedded terminal, the per-provider playbook, and an escape hatch to your own shell.
        </span>
      </div>
    </div>
  );
}

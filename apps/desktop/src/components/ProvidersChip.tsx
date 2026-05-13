import { cn } from '@kay-am/ui';
import { useAppStore } from '../store';

const PROVIDER_DOT: Record<string, string> = {
  anthropic: 'bg-[var(--color-provider-anthropic)]',
  cursor: 'bg-[var(--color-provider-cursor)]',
  codex: 'bg-[var(--color-provider-codex)]',
  opencode: 'bg-[var(--color-provider-opencode)]',
};

export function ProvidersChip() {
  const providers = useAppStore((s) => s.providers);
  const connected = providers.filter((p) => p.connection === 'connected');
  const total = providers.length;
  const allOk = total > 0 && connected.length === total;

  const onClick = () => {
    window.dispatchEvent(
      new CustomEvent('kayam:open-settings', { detail: { section: 'providers' } }),
    );
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs hover:bg-muted',
        allOk ? 'text-muted-foreground' : 'text-danger',
      )}
      title="open settings → providers"
    >
      <span aria-hidden className="flex items-center -space-x-0.5">
        {providers.map((p) => (
          <span
            key={p.id}
            className={cn(
              'inline-block h-2 w-2 rounded-full ring-1 ring-subtle',
              p.connection === 'connected'
                ? (PROVIDER_DOT[p.id] ?? 'bg-primary')
                : 'bg-muted-foreground/30',
            )}
            title={`${p.label}: ${p.connection}`}
          />
        ))}
      </span>
      <span>
        {connected.length}/{total} providers
      </span>
    </button>
  );
}

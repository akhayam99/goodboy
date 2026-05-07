import { cn } from '@kay-am/ui';
import { useAppStore } from '../store';

interface ProvidersChipProps {
  onOpenSettings: () => void;
}

export function ProvidersChip({ onOpenSettings }: ProvidersChipProps) {
  const providers = useAppStore((s) => s.providers);
  const active = providers.filter((p) => p.state !== 'coming-soon');
  const connected = active.filter((p) => p.state === 'connected').length;
  const total = active.length;
  const allOk = total > 0 && connected === total;

  return (
    <button
      type="button"
      onClick={onOpenSettings}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs hover:bg-muted',
        allOk ? 'text-muted-foreground' : 'text-danger',
      )}
      title="open settings → providers"
    >
      <span
        aria-hidden
        className={cn('inline-block h-1.5 w-1.5 rounded-full', allOk ? 'bg-primary' : 'bg-danger')}
      />
      <span>
        {connected}/{total} providers
      </span>
    </button>
  );
}

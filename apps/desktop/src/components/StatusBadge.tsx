import { Check, Circle, Loader, Pencil, X } from 'lucide-react';
import { cn } from '@kay-am/ui';
import type { TurnState } from '@kay-am/types';

interface StatusIconProps {
  kind: TurnState['kind'];
  className?: string;
}

function StatusIcon({ kind, className }: StatusIconProps) {
  switch (kind) {
    case 'draft':
      return <Pencil size={11} className={className} aria-hidden />;
    case 'starting':
      return <Loader size={11} className={cn('motion-safe:animate-spin', className)} aria-hidden />;
    case 'running':
      return (
        <span
          className={cn(
            'inline-block h-2 w-2 rounded-full bg-current motion-safe:animate-pulse',
            className,
          )}
          aria-hidden
        />
      );
    case 'idle':
      return <Circle size={11} fill="currentColor" className={className} aria-hidden />;
    case 'ended':
      return <Check size={11} className={className} aria-hidden />;
    case 'error':
      return <X size={11} className={className} aria-hidden />;
  }
}

const TONE: Record<TurnState['kind'], string> = {
  draft: 'text-muted-foreground',
  starting: 'text-primary',
  idle: 'text-foreground/60',
  running: 'text-primary',
  error: 'text-danger',
  ended: 'text-success',
};

export function StatusBadge({ state, className }: { state: TurnState; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center', TONE[state.kind], className)}
      title={state.kind}
      aria-label={state.kind}
    >
      <StatusIcon kind={state.kind} />
    </span>
  );
}

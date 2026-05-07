import { cn } from '@kay-am/ui';
import type { SessionState } from '@kay-am/types';

const TONE: Record<SessionState['kind'], string> = {
  draft: 'bg-muted text-muted-foreground',
  starting: 'bg-primary/10 text-primary',
  idle: 'bg-muted text-foreground',
  running: 'bg-primary/15 text-primary',
  error: 'bg-danger/10 text-danger',
  ended: 'bg-muted text-muted-foreground',
};

export function StatusBadge({ state, className }: { state: SessionState; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        TONE[state.kind],
        className,
      )}
    >
      {state.kind}
    </span>
  );
}

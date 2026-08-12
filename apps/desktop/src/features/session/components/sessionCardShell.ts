import { cn } from '@goodboy/ui';
import type { SessionStage } from '@goodboy/types';

type Params = {
  readonly stage: SessionStage;
  readonly selected?: boolean;
  readonly active?: boolean;
  readonly dimmed?: boolean;
};

export const sessionCardShell = ({ stage, selected, active, dimmed }: Params): string =>
  cn(
    'rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
    active === true
      ? 'bg-elevated text-foreground shadow-sm'
      : 'bg-muted/40 text-foreground/70 hover:bg-muted/60 hover:text-foreground',
    active === true
      ? 'border-border'
      : stage === 'running'
        ? 'border-info/50'
        : stage === 'attention'
          ? 'border-warning/50'
          : 'border-transparent',
    selected === true && 'border-primary bg-primary/5 text-foreground',
    dimmed === true && 'opacity-50',
  );

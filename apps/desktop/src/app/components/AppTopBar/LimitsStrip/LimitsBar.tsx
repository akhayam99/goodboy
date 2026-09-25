import type { LimitsChipState } from '@goodboy/core';
import { cn } from '@goodboy/ui';

type Props = {
  readonly state: LimitsChipState;
  readonly usedFraction: number | null;
  readonly isStale: boolean;
  readonly className?: string;
};

const FILL: Readonly<Record<LimitsChipState, string>> = {
  normal: 'bg-muted-foreground',
  stale: 'bg-muted-foreground',
  warning: 'bg-warning',
  out: 'bg-danger',
  reset: '',
  waiting: '',
  none: '',
};

export const LimitsBar = ({ state, usedFraction, isStale, className }: Props) => {
  const isEmpty = state === 'reset' || state === 'waiting' || state === 'none';
  if (isEmpty) {
    return (
      <span
        aria-hidden
        data-limits-bar="empty"
        className={cn(
          'block h-1 shrink-0 rounded-full border border-dashed border-border',
          state === 'none' ? 'w-3' : 'w-6',
          className,
        )}
      />
    );
  }
  const width = `${Math.round(Math.min(Math.max(usedFraction ?? 0, 0), 1) * 100)}%`;
  return (
    <span
      aria-hidden
      data-limits-bar="filled"
      className={cn(
        'relative block h-1 w-6 shrink-0 overflow-hidden rounded-full bg-muted',
        className,
      )}
    >
      <span
        className={cn(
          'absolute inset-y-0 left-0 rounded-full',
          FILL[state],
          isStale && 'opacity-50',
        )}
        style={{ width }}
      />
    </span>
  );
};

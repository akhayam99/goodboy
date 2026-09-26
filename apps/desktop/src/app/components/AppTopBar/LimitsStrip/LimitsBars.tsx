import type { LimitsChipState } from '@goodboy/core';
import type { ProviderLimitWindow, ProviderLimitWindowKind } from '@goodboy/types';
import { cn } from '@goodboy/ui';

type Props = {
  readonly state: LimitsChipState;
  readonly windows: ReadonlyArray<ProviderLimitWindow>;
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

const TRACKS: ReadonlyArray<ProviderLimitWindowKind> = ['fiveHour', 'weekly'];

type FractionParams = {
  readonly windows: ReadonlyArray<ProviderLimitWindow>;
  readonly kind: ProviderLimitWindowKind;
};

const trackWidth = ({ windows, kind }: FractionParams): string => {
  const window = windows.find((entry) => entry.kind === kind);
  const fraction = window?.status === 'reached' ? 1 : (window?.usedFraction ?? 0);
  return `${Math.round(Math.min(Math.max(fraction, 0), 1) * 100)}%`;
};

export const LimitsBars = ({ state, windows, isStale, className }: Props) => {
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
  return (
    <span
      aria-hidden
      data-limits-bar="filled"
      className={cn('flex w-6 shrink-0 flex-col gap-0.5', className)}
    >
      {TRACKS.map((kind) => (
        <span
          key={kind}
          data-limits-track={kind}
          className="relative block h-0.75 w-full overflow-hidden rounded-full bg-muted"
        >
          <span
            className={cn(
              'absolute inset-y-0 left-0 rounded-full',
              FILL[state],
              isStale && 'opacity-50',
            )}
            style={{ width: trackWidth({ windows, kind }) }}
          />
        </span>
      ))}
    </span>
  );
};

import type { LimitsChipState } from '@goodboy/core';
import type { ProviderLimitStatus, ProviderLimitWindow } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { WINDOW_TONE_FILL, windowTone } from '../../../../features/providers/limits/windowTone';

type Props = {
  readonly state: LimitsChipState;
  readonly windows: ReadonlyArray<ProviderLimitWindow>;
  readonly isStale: boolean;
  readonly className?: string;
};

const SHOWN_PERCENT_FROM = 0.7;

const STATUS_RANK: Readonly<Record<ProviderLimitStatus, number>> = {
  ok: 0,
  warning: 1,
  reached: 2,
};

type MoreUsedParams = {
  readonly left: ProviderLimitWindow;
  readonly right: ProviderLimitWindow;
};

const isMoreUsed = ({ left, right }: MoreUsedParams): boolean => {
  const rankDelta = STATUS_RANK[left.status] - STATUS_RANK[right.status];
  if (rankDelta !== 0) {
    return rankDelta > 0;
  }
  return (left.usedFraction ?? -1) > (right.usedFraction ?? -1);
};

type TightestParams = {
  readonly windows: ReadonlyArray<ProviderLimitWindow>;
};

const tightestOf = ({ windows }: TightestParams): ProviderLimitWindow | null =>
  windows.reduce<ProviderLimitWindow | null>(
    (best, entry) => (best === null || isMoreUsed({ left: entry, right: best }) ? entry : best),
    null,
  );

type WidthParams = {
  readonly window: ProviderLimitWindow | null;
};

const fractionOf = ({ window }: WidthParams): number =>
  window?.status === 'reached' ? 1 : Math.min(Math.max(window?.usedFraction ?? 0, 0), 1);

const trackWidth = ({ window }: WidthParams): string =>
  `${Math.round(fractionOf({ window }) * 100)}%`;

type FillParams = {
  readonly window: ProviderLimitWindow | null;
};

const trackFill = ({ window }: FillParams): string =>
  window === null ? WINDOW_TONE_FILL.neutral : WINDOW_TONE_FILL[windowTone({ window })];

export const LimitsBars = ({ state, windows, isStale, className }: Props) => {
  const isEmpty = state === 'waiting' || state === 'none';
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
  const window = tightestOf({ windows });
  const fraction = fractionOf({ window });
  return (
    <span
      aria-hidden
      data-limits-bar="filled"
      className={cn('flex shrink-0 items-center gap-1', className)}
    >
      <span
        data-limits-track={window?.kind ?? 'none'}
        className="relative block h-1 w-6 overflow-hidden rounded-full bg-muted"
      >
        <span
          className={cn(
            'absolute inset-y-0 left-0 rounded-full',
            trackFill({ window }),
            isStale && 'opacity-50',
          )}
          style={{ width: trackWidth({ window }) }}
        />
      </span>
      {fraction > SHOWN_PERCENT_FROM ? (
        <span data-limits-percent="" className="text-meta tabular-nums text-faint-foreground">
          {`${Math.round(fraction * 100)}%`}
        </span>
      ) : null}
    </span>
  );
};

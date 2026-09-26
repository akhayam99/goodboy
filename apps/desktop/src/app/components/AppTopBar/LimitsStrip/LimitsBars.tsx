import type { LimitsChipState } from '@goodboy/core';
import type {
  ProviderLimitStatus,
  ProviderLimitWindow,
  ProviderLimitWindowKind,
} from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { WINDOW_TONE_FILL, windowTone } from '../../../../features/providers/limits/windowTone';

type Props = {
  readonly state: LimitsChipState;
  readonly windows: ReadonlyArray<ProviderLimitWindow>;
  readonly isStale: boolean;
  readonly className?: string;
};

const TRACKS: ReadonlyArray<ProviderLimitWindowKind> = ['fiveHour', 'weekly'];

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

const worstOf = (candidates: ReadonlyArray<ProviderLimitWindow>): ProviderLimitWindow | null =>
  candidates.reduce<ProviderLimitWindow | null>(
    (best, entry) => (best === null || isMoreUsed({ left: entry, right: best }) ? entry : best),
    null,
  );

type TrackWindowParams = {
  readonly windows: ReadonlyArray<ProviderLimitWindow>;
  readonly kind: ProviderLimitWindowKind;
};

const trackWindow = ({ windows, kind }: TrackWindowParams): ProviderLimitWindow | null => {
  const exact = worstOf(windows.filter((entry) => entry.kind === kind));
  if (exact !== null || kind !== 'weekly') {
    return exact;
  }
  return worstOf(windows.filter((entry) => entry.kind === 'weeklyModel'));
};

type WidthParams = {
  readonly window: ProviderLimitWindow | null;
};

const trackWidth = ({ window }: WidthParams): string => {
  const fraction = window?.status === 'reached' ? 1 : (window?.usedFraction ?? 0);
  return `${Math.round(Math.min(Math.max(fraction, 0), 1) * 100)}%`;
};

type FillParams = {
  readonly window: ProviderLimitWindow | null;
};

const trackFill = ({ window }: FillParams): string =>
  window === null ? WINDOW_TONE_FILL.neutral : WINDOW_TONE_FILL[windowTone({ window })];

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
      {TRACKS.map((kind) => {
        const window = trackWindow({ windows, kind });
        return (
          <span
            key={kind}
            data-limits-track={kind}
            className="relative block h-0.75 w-full overflow-hidden rounded-full bg-muted"
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
        );
      })}
    </span>
  );
};

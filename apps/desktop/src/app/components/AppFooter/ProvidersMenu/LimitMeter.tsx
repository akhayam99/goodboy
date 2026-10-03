import type { ProviderLimitWindow } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { formatLimitReset } from '../../../../features/providers/limits/formatLimitReset';
import { formatUsedPercent } from '../../../../features/providers/limits/formatUsedPercent';
import {
  WINDOW_TONE_FILL,
  WINDOW_TONE_TEXT,
  windowTone,
} from '../../../../features/providers/limits/windowTone';

type Props = {
  readonly label: string;
  readonly window: ProviderLimitWindow | null;
  readonly nowMs: number;
};

const fractionOf = ({ window }: Pick<Props, 'window'>): number => {
  if (window === null) {
    return 0;
  }
  if (window.status === 'reached') {
    return 1;
  }
  return Math.min(Math.max(window.usedFraction ?? 0, 0), 1);
};

export const LimitMeter = ({ label, window, nowMs }: Props) => {
  const tone = window === null ? 'neutral' : windowTone({ window });
  const fraction = fractionOf({ window });
  const isReached = window !== null && tone === 'danger';
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-secondary text-faint-foreground">
      <span>{label}</span>
      <span className="relative block h-1 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
        <span
          className={cn('absolute inset-y-0 left-0 rounded-full', WINDOW_TONE_FILL[tone])}
          style={{ width: `${Math.round(fraction * 100)}%` }}
        />
      </span>
      <span className={cn('tabular-nums', WINDOW_TONE_TEXT[tone])}>
        {window === null ? 'n/a' : formatUsedPercent({ usedFraction: fraction })}
      </span>
      {isReached && window.resetsAt !== null ? (
        <span className={WINDOW_TONE_TEXT.danger}>
          until {formatLimitReset({ iso: window.resetsAt, nowMs })}
        </span>
      ) : null}
    </span>
  );
};

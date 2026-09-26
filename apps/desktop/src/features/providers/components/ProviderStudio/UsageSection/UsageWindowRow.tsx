import type { ProviderLimitWindow } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { formatLimitReset, formatTimeUntil } from '../../../limits/formatLimitReset';
import { formatUsedPercent } from '../../../limits/formatUsedPercent';
import { limitWindowLabel } from '../../../limits/limitWindowLabel';
import { WINDOW_TONE_FILL, WINDOW_TONE_TEXT, windowTone } from '../../../limits/windowTone';

type Props = {
  readonly window: ProviderLimitWindow;
  readonly siblings: ReadonlyArray<ProviderLimitWindow>;
  readonly nowMs: number;
};

const resetText = ({ window, nowMs }: Pick<Props, 'window' | 'nowMs'>): string => {
  if (window.resetsAt === null) {
    return '';
  }
  const at = formatLimitReset({ iso: window.resetsAt, nowMs });
  const isOut = window.status === 'reached' || (window.usedFraction ?? 0) >= 1;
  if (isOut) {
    return `Out until ${at}`;
  }
  const until = formatTimeUntil({ iso: window.resetsAt, nowMs });
  return until === '' ? `Resets ${at}` : `Resets ${at} · ${until}`;
};

export const UsageWindowRow = ({ window, siblings, nowMs }: Props) => {
  const tone = windowTone({ window });
  const width = `${Math.round(Math.min(Math.max(window.usedFraction ?? 0, 0), 1) * 100)}%`;
  return (
    <li className="grid h-10 grid-cols-[160px_1fr_96px_180px] items-center gap-3 text-label">
      <span className="truncate text-foreground">{limitWindowLabel({ window, siblings })}</span>
      <span aria-hidden className="relative h-1.5 overflow-hidden rounded-full bg-muted">
        {window.usedFraction === null ? null : (
          <span
            className={cn('absolute inset-y-0 left-0 rounded-full', WINDOW_TONE_FILL[tone])}
            style={{ width }}
          />
        )}
      </span>
      <span
        className={cn('tabular-nums', WINDOW_TONE_TEXT[tone], tone !== 'neutral' && 'font-medium')}
      >
        {window.usedFraction === null
          ? 'Within limits'
          : `${formatUsedPercent({ usedFraction: window.usedFraction })} used`}
      </span>
      <span className="truncate tabular-nums text-faint-foreground">
        {resetText({ window, nowMs })}
      </span>
    </li>
  );
};

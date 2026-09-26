import type { LimitsChip as LimitsChipModel } from '@goodboy/core';
import { Tooltip, cn } from '@goodboy/ui';
import { Clock, TriangleAlert } from 'lucide-react';
import {
  PROVIDER_BRAND,
  brandColor,
} from '../../../../features/providers/components/provider-brand';
import { PROVIDER_LABEL } from '../../../../features/providers/providerLabel';
import { formatLimitResetShort } from '../../../../features/providers/limits/formatLimitReset';
import { formatUsedPercent } from '../../../../features/providers/limits/formatUsedPercent';
import { limitsChipHeadline } from '../../../../features/providers/limits/limitsChipHeadline';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { limitWindowShortLabel } from '../../../../features/providers/limits/limitWindowShortLabel';
import { LimitsBars } from './LimitsBars';
import { LimitsTooltip } from './LimitsTooltip';

type Props = {
  readonly chip: LimitsChipModel;
  readonly nowMs: number;
  readonly isPressed: boolean;
  readonly className?: string;
  readonly onOpen: (chip: LimitsChipModel) => void;
};

export const LimitsChip = ({ chip, nowMs, isPressed, className, onOpen }: Props) => {
  const Glyph = PROVIDER_BRAND[chip.providerId].icon;
  const headline = limitsChipHeadline({ chip, nowMs });
  const hasClock =
    chip.state === 'stale' || chip.state === 'reset' || (chip.isStale && chip.state !== 'waiting');
  return (
    <Tooltip content={<LimitsTooltip chip={chip} nowMs={nowMs} />} variant="card" side="bottom">
      <button
        type="button"
        data-limits-chip={chip.providerId}
        data-limits-state={chip.state}
        aria-pressed={isPressed}
        aria-label={`${PROVIDER_LABEL[chip.providerId]} limits. ${headline}`}
        onClick={() => onOpen(chip)}
        className={cn(
          'flex h-6 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-2xs motion-safe:transition-colors',
          isPressed ? 'bg-muted' : 'hover:bg-hover',
          className,
        )}
      >
        <Glyph
          size={ICON_SIZE.row}
          aria-hidden
          className={cn('shrink-0', chip.state === 'none' && 'text-faint-foreground')}
          {...(chip.state !== 'none' && { style: { color: brandColor(chip.providerId) } })}
        />
        <LimitsBars state={chip.state} windows={chip.windows} isStale={chip.isStale} />
        {chip.state === 'warning' ? (
          <span className="flex items-center gap-0.5 text-warning">
            <TriangleAlert size={10} aria-hidden />
            {chip.usedFraction === null ? null : (
              <span className="font-medium tabular-nums">
                {chip.window === null ? null : (
                  <span className="font-normal">
                    {limitWindowShortLabel({ window: chip.window })}{' '}
                  </span>
                )}
                {formatUsedPercent({ usedFraction: chip.usedFraction })}
              </span>
            )}
          </span>
        ) : null}
        {chip.state === 'out' ? (
          <span className="flex items-center gap-1">
            <span className="font-medium text-danger">Out</span>
            {chip.resetsAt === null ? null : (
              <span className="tabular-nums text-muted-foreground">
                · {formatLimitResetShort({ iso: chip.resetsAt, nowMs })}
              </span>
            )}
          </span>
        ) : null}
        {hasClock ? (
          <Clock size={10} aria-hidden className="shrink-0 text-faint-foreground" />
        ) : null}
      </button>
    </Tooltip>
  );
};

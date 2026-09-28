import type { LimitsChip as LimitsChipModel } from '@goodboy/core';
import { Tooltip, cn } from '@goodboy/ui';
import {
  PROVIDER_BRAND,
  brandColor,
} from '../../../../features/providers/components/provider-brand';
import { PROVIDER_LABEL } from '../../../../features/providers/providerLabel';
import { limitsChipHeadline } from '../../../../features/providers/limits/limitsChipHeadline';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
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
          'flex h-6 shrink-0 items-center gap-1.5 rounded-md px-1.5 motion-safe:transition-colors',
          isPressed ? 'bg-muted' : 'hover:bg-hover',
          className,
        )}
      >
        <Glyph
          size={ICON_SIZE.row}
          aria-hidden
          className="shrink-0"
          style={{ color: brandColor(chip.providerId) }}
        />
        <LimitsBars state={chip.state} windows={chip.windows} isStale={chip.isStale} />
      </button>
    </Tooltip>
  );
};

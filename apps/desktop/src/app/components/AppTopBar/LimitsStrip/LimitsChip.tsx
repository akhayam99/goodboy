import type { LimitsChip as LimitsChipModel } from '@goodboy/core';
import { cn, FOCUS_RING, ICON_SIZE, TOP_BAR_CONTROL } from '@goodboy/ui';
import { ProviderGlyph } from '../../../../shared/components/RoutingPicker/ProviderGlyph';
import { PROVIDER_LABEL } from '../../../../features/providers/providerLabel';
import { limitsChipHeadline } from '../../../../features/providers/limits/limitsChipHeadline';

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
  const headline = limitsChipHeadline({ chip, nowMs });
  return (
    <LimitsTooltip chip={chip} nowMs={nowMs}>
      <button
        type="button"
        data-limits-chip={chip.providerId}
        data-limits-state={chip.state}
        aria-pressed={isPressed}
        aria-label={`${PROVIDER_LABEL[chip.providerId]} limits. ${headline}`}
        onClick={() => onOpen(chip)}
        className={cn(
          TOP_BAR_CONTROL.height,
          TOP_BAR_CONTROL.radius,
          FOCUS_RING,
          'flex shrink-0 items-center gap-2 px-2 motion-safe:transition-colors',
          isPressed ? 'bg-muted' : 'hover:bg-hover',
          className,
        )}
      >
        <ProviderGlyph id={chip.providerId} size={ICON_SIZE.row} />
        <LimitsBars state={chip.state} windows={chip.windows} isStale={chip.isStale} />
      </button>
    </LimitsTooltip>
  );
};

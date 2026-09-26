import { worstLimitsChip, type LimitsChip } from '@goodboy/core';
import { AnchoredPopover, cn, useDropdown } from '@goodboy/ui';
import { TriangleAlert } from 'lucide-react';
import {
  PROVIDER_BRAND,
  brandColor,
} from '../../../../features/providers/components/provider-brand';
import { PROVIDER_LABEL } from '../../../../features/providers/providerLabel';
import { formatLimitReset } from '../../../../features/providers/limits/formatLimitReset';
import { formatUsedPercent } from '../../../../features/providers/limits/formatUsedPercent';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { LimitsBar } from './LimitsBar';

type Props = {
  readonly hidden: ReadonlyArray<LimitsChip>;
  readonly nowMs: number;
  readonly className?: string;
  readonly onOpen: (chip: LimitsChip) => void;
};

const PANEL_WIDTH = 300;
const ROW_HEIGHT = 32;

type ValueParams = {
  readonly chip: LimitsChip;
  readonly nowMs: number;
};

const rowValue = ({ chip, nowMs }: ValueParams): string => {
  if (chip.state === 'none' || chip.state === 'waiting') {
    return 'no data';
  }
  if (chip.state === 'reset') {
    return 'reset';
  }
  const used =
    chip.usedFraction === null ? '' : `${formatUsedPercent({ usedFraction: chip.usedFraction })}`;
  const reset =
    chip.resetsAt === null ? '' : `resets ${formatLimitReset({ iso: chip.resetsAt, nowMs })}`;
  return [used, reset].filter((part) => part !== '').join(' · ');
};

export const LimitsOverflowPopover = ({ hidden, nowMs, className, onOpen }: Props) => {
  const dropdown = useDropdown({
    align: 'end',
    width: 'w-75',
    expectedWidth: PANEL_WIDTH,
    expectedHeight: hidden.length * ROW_HEIGHT + 12,
  });
  const { open: isOpen, close, toggle } = dropdown;
  const worst = worstLimitsChip({ chips: hidden });
  const label = `${hidden.length} more ${hidden.length === 1 ? 'provider' : 'providers'}`;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="More provider limits"
      hasBackdrop
      {...(className !== undefined && { anchorClassName: className })}
      trigger={
        <button
          type="button"
          data-limits-chip="overflow"
          aria-label={label}
          aria-expanded={isOpen}
          onClick={toggle}
          className={cn(
            'flex h-6 shrink-0 items-center gap-0.5 rounded-md px-1.5 text-secondary font-medium tabular-nums text-muted-foreground motion-safe:transition-colors',
            isOpen ? 'bg-muted' : 'hover:bg-hover',
          )}
        >
          <span>+{hidden.length}</span>
          {worst === null ? null : (
            <TriangleAlert
              size={10}
              aria-hidden
              className={worst.state === 'out' ? 'text-danger' : 'text-warning'}
            />
          )}
        </button>
      }
    >
      <ul aria-label="More provider limits" className="flex flex-col p-1.5">
        {hidden.map((chip) => {
          const Glyph = PROVIDER_BRAND[chip.providerId].icon;
          return (
            <li key={chip.providerId}>
              <button
                type="button"
                onClick={() => {
                  close();
                  onOpen(chip);
                }}
                className="flex h-8 w-full items-center gap-2 rounded-sm px-2 text-label hover:bg-hover"
              >
                <Glyph
                  size={ICON_SIZE.row}
                  aria-hidden
                  className="shrink-0"
                  style={{ color: brandColor(chip.providerId) }}
                />
                <span className="w-21 truncate text-left text-foreground">
                  {PROVIDER_LABEL[chip.providerId]}
                </span>
                <LimitsBar
                  state={chip.state}
                  usedFraction={chip.usedFraction}
                  isStale={chip.isStale}
                  className="w-15"
                />
                <span className="flex-1 truncate text-right text-secondary text-faint-foreground">
                  {rowValue({ chip, nowMs })}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </AnchoredPopover>
  );
};

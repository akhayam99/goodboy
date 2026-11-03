import { worstLimitsChip, type LimitsChip } from '@goodboy/core/providers';
import {
  AnchoredPopover,
  cn,
  FOCUS_RING,
  ICON_SIZE,
  POPOVER_WIDTH_CLASS,
  POPOVER_WIDTH_PX,
  SelectableRow,
  TOP_BAR_CONTROL,
  useDropdown,
} from '@goodboy/ui';
import { TriangleAlert } from 'lucide-react';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { ProviderGlyph } from '../../../../shared/components/RoutingPicker/ProviderGlyph';
import { NAMES } from '../../../../shared/utils/names';
import { nounFor } from '../../../../shared/utils/nounFor';
import { PROVIDER_LABEL } from '../../../../features/providers/providerLabel';
import { formatLimitReset } from '../../../../features/providers/limits/formatLimitReset';
import { formatUsedPercent } from '../../../../features/providers/limits/formatUsedPercent';

import { LimitsBars } from './LimitsBars';

type Props = {
  readonly hidden: ReadonlyArray<LimitsChip>;
  readonly nowMs: number;
  readonly className?: string;
  readonly hasShownChips: boolean;
  readonly onOpen: (chip: LimitsChip) => void;
};

const MAX_MARKS = 3;

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

export const LimitsOverflowPopover = ({
  hidden,
  nowMs,
  className,
  hasShownChips,
  onOpen,
}: Props) => {
  const dropdown = useDropdown({
    align: 'end',
    width: POPOVER_WIDTH_CLASS.standard,
    expectedWidth: POPOVER_WIDTH_PX.standard,
  });
  const { open: isOpen, close, toggle } = dropdown;
  const worst = worstLimitsChip({ chips: hidden });
  const noun = nounFor({ count: hidden.length, one: 'provider' });
  const label = hasShownChips ? `${hidden.length} more ${noun}` : 'Provider usage';

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="More provider usage"
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
            TOP_BAR_CONTROL.height,
            TOP_BAR_CONTROL.radius,
            FOCUS_RING,
            'flex shrink-0 items-center gap-1 px-2 text-chip tabular-nums text-muted-foreground motion-safe:transition-colors',
            isOpen ? 'bg-muted' : 'hover:bg-hover',
          )}
        >
          {hasShownChips ? null : <CONCEPT_ICONS.providers size={ICON_SIZE.control} aria-hidden />}
          <span>{hasShownChips ? `+${hidden.length} ${noun}` : NAMES.usage}</span>
          {hasShownChips ? (
            <span data-limits-overflow-marks="" className="flex items-center gap-0.5">
              {hidden.slice(0, MAX_MARKS).map((chip) => (
                <span key={chip.providerId} data-limits-mark={chip.providerId} className="flex">
                  <ProviderGlyph id={chip.providerId} size={ICON_SIZE.row} />
                </span>
              ))}
            </span>
          ) : null}
          {worst === null ? null : (
            <TriangleAlert
              data-limits-alert=""
              size={ICON_SIZE.mark}
              aria-hidden
              className={worst.state === 'out' ? 'text-danger' : 'text-warning'}
            />
          )}
        </button>
      }
    >
      <ul aria-label="More provider usage" className="flex flex-col p-2">
        {hidden.map((chip) => {
          return (
            <li key={chip.providerId}>
              <SelectableRow
                selected={false}
                onClick={() => {
                  close();
                  onOpen(chip);
                }}
                className="min-h-8 items-center gap-2 rounded-sm px-2 text-meta"
              >
                <ProviderGlyph id={chip.providerId} size={ICON_SIZE.row} />
                <span className="w-21 truncate text-left text-foreground">
                  {PROVIDER_LABEL[chip.providerId]}
                </span>
                <LimitsBars
                  state={chip.state}
                  windows={chip.windows}
                  isStale={chip.isStale}
                  className="w-15"
                />
                <span className="flex-1 truncate text-right text-meta text-faint-foreground">
                  {rowValue({ chip, nowMs })}
                </span>
              </SelectableRow>
            </li>
          );
        })}
      </ul>
    </AnchoredPopover>
  );
};

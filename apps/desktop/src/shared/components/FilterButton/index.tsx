import type { ReactNode } from 'react';
import { ListFilter } from 'lucide-react';
import { AnchoredPopover, Button, Chip, Tooltip, cn, useDropdown } from '@goodboy/ui';
import { ICON_SIZE } from '../conceptIcons';

type Props = {
  readonly popoverLabel: string;
  readonly activeCount: number;
  readonly facets: ReactNode;
  readonly popoverHeight?: number;
};

export const FilterButton = ({ popoverLabel, activeCount, facets, popoverHeight = 420 }: Props) => {
  const dropdown = useDropdown({ align: 'end', width: 'w-80', expectedHeight: popoverHeight });
  const hasActive = activeCount > 0;
  const label = hasActive ? `Filters, ${activeCount} active` : 'Filters';

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={popoverLabel}
      className="max-h-[70vh] py-1"
      trigger={
        <Tooltip content="Filters">
          <Button
            variant="secondary"
            size="sm"
            aria-label={label}
            data-filter-button=""
            aria-expanded={dropdown.open}
            aria-haspopup="dialog"
            onClick={dropdown.toggle}
            className={cn(dropdown.open && 'bg-selected')}
          >
            <ListFilter size={ICON_SIZE.row} aria-hidden />
            {hasActive ? <Chip kind="count" tone="neutral" label={activeCount} /> : null}
          </Button>
        </Tooltip>
      }
    >
      {facets}
    </AnchoredPopover>
  );
};

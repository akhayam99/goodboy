import type { ReactNode } from 'react';
import { ListFilter } from '@goodboy/ui/icons';
import {
  AnchoredPopover,
  Button,
  cn,
  CountBadge,
  ICON_SIZE,
  Tooltip,
  useDropdown,
} from '@goodboy/ui';

type Props = {
  readonly label?: string;
  readonly popoverLabel: string;
  readonly activeCount: number;
  readonly facets: ReactNode;
  readonly popoverHeight?: number;
  readonly word?: string;
};

export const FilterButton = ({
  label: name = 'Filters',
  popoverLabel,
  activeCount,
  facets,
  popoverHeight = 420,
  word,
}: Props) => {
  const dropdown = useDropdown({ width: 'w-80', expectedHeight: popoverHeight });
  const hasActive = activeCount > 0;
  const label = hasActive ? `${name}, ${activeCount} active` : name;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={popoverLabel}
      className="max-h-[70vh] py-1"
      trigger={
        <Tooltip content={name} isSuppressed={dropdown.open || word !== undefined}>
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
            {word === undefined ? null : <span aria-hidden>{word}</span>}
            <CountBadge count={activeCount} isAnnounced={false} />
          </Button>
        </Tooltip>
      }
    >
      {facets}
    </AnchoredPopover>
  );
};

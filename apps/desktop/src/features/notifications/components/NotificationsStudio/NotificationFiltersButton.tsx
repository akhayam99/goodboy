import type { ReactNode } from 'react';
import { ListFilter } from 'lucide-react';
import { AnchoredPopover, Button, Chip, cn, useDropdown } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly activeCount: number;
  readonly facets: ReactNode;
};

export const NotificationFiltersButton = ({ activeCount, facets }: Props) => {
  const filters = useDropdown({ align: 'end', width: 'w-80', expectedHeight: 420 });
  return (
    <AnchoredPopover
      dropdown={filters}
      role="dialog"
      ariaLabel="Notification filters"
      className="max-h-[70vh] py-1"
      trigger={
        <Button
          variant="secondary"
          size="sm"
          onClick={filters.toggle}
          aria-expanded={filters.open}
          className={cn(filters.open && 'bg-selected')}
        >
          <ListFilter size={ICON_SIZE.row} aria-hidden />
          Filters
          {activeCount > 0 ? <Chip kind="count" tone="neutral" label={activeCount} /> : null}
        </Button>
      }
    >
      {facets}
    </AnchoredPopover>
  );
};

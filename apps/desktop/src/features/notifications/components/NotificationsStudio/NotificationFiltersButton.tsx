import type { ReactNode } from 'react';
import { ListFilter } from 'lucide-react';
import { AnchoredPopover, KbdPill, cn, useDropdown } from '@goodboy/ui';
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
        <button
          type="button"
          onClick={filters.toggle}
          aria-expanded={filters.open}
          className={cn(
            'flex h-7 items-center gap-2 rounded-md border border-border-soft px-2 text-label text-muted-foreground hover:bg-hover hover:text-foreground',
            filters.open && 'bg-selected text-foreground',
          )}
        >
          <ListFilter size={ICON_SIZE.row} aria-hidden />
          Filters
          {activeCount > 0 ? <KbdPill>{activeCount}</KbdPill> : null}
        </button>
      }
    >
      {facets}
    </AnchoredPopover>
  );
};

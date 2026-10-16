import type { ReactNode } from 'react';
import { AnchoredPopover, Button, Chip, cn, useDropdown } from '@goodboy/ui';

type Props = {
  readonly activeCount: number;
  readonly facets: ReactNode;
};

export const TasksFilterMenu = ({ activeCount, facets }: Props) => {
  const dropdown = useDropdown({ align: 'end', width: 'w-80', expectedHeight: 420 });
  const hasActive = activeCount > 0;
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Task filters"
      className="max-h-[70vh] py-1"
      trigger={
        <Button
          variant="secondary"
          size="sm"
          data-tasks-filter=""
          aria-label={hasActive ? `Filter, ${activeCount} active` : 'Filter'}
          aria-expanded={dropdown.open}
          aria-haspopup="dialog"
          onClick={dropdown.toggle}
          className={cn(dropdown.open && 'bg-selected')}
        >
          Filter
          {hasActive ? <Chip kind="count" tone="neutral" label={activeCount} /> : null}
        </Button>
      }
    >
      {facets}
    </AnchoredPopover>
  );
};

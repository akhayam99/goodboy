import type { ReactNode } from 'react';
import { AnchoredPopover, Button, cn, useDropdown } from '@goodboy/ui';

type Props = {
  readonly activeCount: number;
  readonly facets: ReactNode;
};

export const TasksFilterMenu = ({ activeCount, facets }: Props) => {
  const dropdown = useDropdown({ align: 'end', width: 'w-80', expectedHeight: 520 });
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
          {hasActive ? (
            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-muted-foreground" />
          ) : null}
        </Button>
      }
    >
      {facets}
    </AnchoredPopover>
  );
};

import { ListFilter } from 'lucide-react';
import { AnchoredPopover, Checkbox, cn, PopoverBody, useDropdown } from '@goodboy/ui';
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_CATEGORY_LABEL,
  type ActivityCategory,
  type ActivityFilter,
} from '../../../../timeline/activityFilter';

type Props = {
  readonly filter: ActivityFilter;
  readonly hiddenCount: number;
  readonly onCategory: (params: {
    readonly category: ActivityCategory;
    readonly enabled: boolean;
  }) => void;
};

export const ActivityFilterButton = ({ filter, hiddenCount, onCategory }: Props) => {
  const dropdown = useDropdown({
    align: 'end',
    expectedHeight: 240,
    expectedWidth: 208,
    width: 'w-52',
  });
  const { open, toggle } = dropdown;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Activity filter"
      className="bg-subtle"
      anchorClassName="inline-flex"
      trigger={
        <button
          type="button"
          onClick={toggle}
          aria-label="Filter the activity feed"
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(
            'inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-2xs motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
            hiddenCount > 0
              ? 'text-foreground hover:bg-muted/60'
              : 'text-muted-foreground/70 hover:bg-muted/60 hover:text-foreground',
          )}
        >
          <ListFilter size={13} aria-hidden className="shrink-0" />
          {hiddenCount > 0 ? hiddenCount : null}
        </button>
      }
    >
      <PopoverBody>
        <div className="flex flex-col gap-2 px-3 py-2.5">
          {ACTIVITY_CATEGORIES.map((category) => (
            <Checkbox
              key={category}
              checked={filter[category]}
              label={ACTIVITY_CATEGORY_LABEL[category]}
              onChange={(enabled) => onCategory({ category, enabled })}
            />
          ))}
        </div>
      </PopoverBody>
    </AnchoredPopover>
  );
};

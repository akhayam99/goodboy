import { Eye, EyeOff, ListFilter } from 'lucide-react';
import { AnchoredPopover, cn, tintClasses, useDropdown } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../../shared/components/conceptIcons';
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_CATEGORY_LABEL,
  type ActivityCategory,
  type ActivityFilter,
} from '../../../../timeline/activityFilter';

const ACTIVITY_CATEGORY_CONCEPT = {
  worktree: 'branch',
  issues: 'issues',
  pullRequests: 'pr',
  workflows: 'workflows',
  agents: 'agents',
  resolver: 'resolve',
  decisions: 'decisions',
} satisfies Record<ActivityCategory, keyof typeof CONCEPT_ICONS>;

const PANEL_LABEL = 'Activity filter';

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
      role="menu"
      ariaLabel={PANEL_LABEL}
      className="bg-subtle py-1"
      anchorClassName="inline-flex"
      trigger={
        <button
          type="button"
          onClick={toggle}
          aria-label="Filter the activity feed"
          aria-haspopup="menu"
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
      {ACTIVITY_CATEGORIES.map((category) => {
        const concept = ACTIVITY_CATEGORY_CONCEPT[category];
        const Icon = CONCEPT_ICONS[concept];
        const isActive = filter[category];
        return (
          <button
            key={category}
            type="button"
            role="menuitemcheckbox"
            aria-checked={isActive}
            onClick={() => onCategory({ category, enabled: !isActive })}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-1.5 text-left motion-safe:transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)]',
              isActive && 'bg-muted/60',
            )}
          >
            <Icon
              size={12}
              aria-hidden
              className={cn(
                'shrink-0',
                isActive ? tintClasses(CONCEPT_TONE[concept]).icon : 'text-muted-foreground/50',
              )}
            />
            <span
              className={cn(
                'flex-1 whitespace-nowrap text-xs',
                isActive ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {ACTIVITY_CATEGORY_LABEL[category]}
            </span>
            {isActive ? (
              <Eye size={12} aria-hidden className="shrink-0 text-muted-foreground" />
            ) : (
              <EyeOff size={12} aria-hidden className="shrink-0 text-muted-foreground/40" />
            )}
          </button>
        );
      })}
    </AnchoredPopover>
  );
};

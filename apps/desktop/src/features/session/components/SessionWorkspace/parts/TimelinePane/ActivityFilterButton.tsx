import { Check, Eye, EyeOff, ListFilter } from 'lucide-react';
import {
  AnchoredPopover,
  Divider,
  PopoverFooter,
  ScrollFade,
  cn,
  tintClasses,
  useDropdown,
} from '@goodboy/ui';
import {
  CONCEPT_ICONS,
  CONCEPT_TONE,
  ICON_SIZE,
} from '../../../../../../shared/components/conceptIcons';
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_CATEGORY_LABEL,
  ACTIVITY_CHILD,
  ACTIVITY_CHILD_TOGGLES,
  type ActivityCategory,
  type ActivityChildToggle,
  type ActivityFilter,
  type ActivityToggle,
} from '../../../../timeline/activityFilter';

const ACTIVITY_CATEGORY_CONCEPT = {
  suggestions: 'suggestion',
  worktree: 'branch',
  issues: 'issues',
  pullRequests: 'pr',
  workflows: 'workflows',
  artifacts: 'artifacts',
  agents: 'agents',
  questions: 'questions',
  resolver: 'resolve',
  decisions: 'decisions',
  session: 'archive',
} satisfies Record<ActivityCategory, keyof typeof CONCEPT_ICONS>;

const PANEL_LABEL = 'Activity filter';

const PANEL_SCROLLER_HEIGHT = 320;

const PANEL_FOOTER_HEIGHT = 33;

const PANEL_EXPECTED_HEIGHT = PANEL_SCROLLER_HEIGHT + PANEL_FOOTER_HEIGHT;

const PANEL_WIDTH = 288;

const PANEL_WIDTH_CLASS = 'w-72';

type Props = {
  readonly filter: ActivityFilter;
  readonly hiddenCount: number;
  readonly onToggle: (params: {
    readonly toggle: ActivityToggle;
    readonly enabled: boolean;
  }) => void;
  readonly onAll: (params: { readonly enabled: boolean }) => void;
};

type EyeMarkProps = {
  readonly isActive: boolean;
};

const EyeMark = ({ isActive }: EyeMarkProps) =>
  isActive ? (
    <Eye
      size={ICON_SIZE.row}
      aria-hidden
      className="shrink-0 text-muted-foreground motion-safe:transition-colors group-hover:text-foreground"
    />
  ) : (
    <EyeOff
      size={ICON_SIZE.row}
      aria-hidden
      className="shrink-0 text-muted-foreground/40 motion-safe:transition-colors group-hover:text-muted-foreground"
    />
  );

type CategoryRowProps = {
  readonly category: ActivityCategory;
  readonly isActive: boolean;
  readonly onToggle: Props['onToggle'];
};

const CategoryRow = ({ category, isActive, onToggle }: CategoryRowProps) => {
  const concept = ACTIVITY_CATEGORY_CONCEPT[category];
  const Icon = CONCEPT_ICONS[concept];
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={isActive}
      onClick={() => onToggle({ toggle: category, enabled: !isActive })}
      className={cn(
        'group flex w-full items-center gap-2 px-3 py-2 text-left motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)]',
        isActive ? 'bg-muted/60 hover:bg-muted' : 'hover:bg-muted/40',
      )}
    >
      <Icon
        size={ICON_SIZE.row}
        aria-hidden
        className={cn(
          'shrink-0',
          isActive ? tintClasses(CONCEPT_TONE[concept]).icon : 'text-muted-foreground/50',
        )}
      />
      <span
        className={cn(
          'flex-1 whitespace-nowrap text-xs leading-4 motion-safe:transition-colors',
          isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground',
        )}
      >
        {ACTIVITY_CATEGORY_LABEL[category]}
      </span>
      <EyeMark isActive={isActive} />
    </button>
  );
};

type ChildChipProps = {
  readonly toggle: ActivityChildToggle;
  readonly isActive: boolean;
  readonly isParentActive: boolean;
  readonly onToggle: Props['onToggle'];
};

const ChildChip = ({ toggle, isActive, isParentActive, onToggle }: ChildChipProps) => {
  const isOn = isActive && isParentActive;
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={isOn}
      aria-label={ACTIVITY_CHILD[toggle].ariaLabel}
      disabled={!isParentActive}
      onClick={() => onToggle({ toggle, enabled: !isActive })}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-2xs motion-safe:transition-colors disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)]',
        isOn
          ? 'border-border bg-muted text-foreground'
          : 'border-border-soft bg-elevated/30 text-muted-foreground',
        isParentActive && !isOn
          ? 'hover:border-border hover:bg-muted/60 hover:text-foreground'
          : '',
        isParentActive && isOn ? 'hover:bg-muted/80' : '',
      )}
    >
      <Check
        size={10}
        aria-hidden
        className={cn(
          'shrink-0 motion-safe:transition-opacity',
          isOn ? 'opacity-100' : 'opacity-0',
        )}
      />
      {ACTIVITY_CHILD[toggle].label}
    </button>
  );
};

type ChildChipRowProps = {
  readonly toggles: ReadonlyArray<ActivityChildToggle>;
  readonly filter: ActivityFilter;
  readonly isParentActive: boolean;
  readonly onToggle: Props['onToggle'];
};

const ChildChipRow = ({ toggles, filter, isParentActive, onToggle }: ChildChipRowProps) => (
  <div
    className={cn(
      'flex flex-wrap items-center gap-1 pl-8 pr-3',
      isParentActive ? '' : 'opacity-50',
    )}
  >
    {toggles.map((toggle) => (
      <ChildChip
        key={toggle}
        toggle={toggle}
        isActive={filter[toggle]}
        isParentActive={isParentActive}
        onToggle={onToggle}
      />
    ))}
  </div>
);

type ChildrenParams = {
  readonly category: ActivityCategory;
};

const childTogglesOf = ({ category }: ChildrenParams): ReadonlyArray<ActivityChildToggle> =>
  ACTIVITY_CHILD_TOGGLES.filter((toggle) => ACTIVITY_CHILD[toggle].parent === category);

export const ActivityFilterButton = ({ filter, hiddenCount, onToggle, onAll }: Props) => {
  const dropdown = useDropdown({
    align: 'end',
    expectedHeight: PANEL_EXPECTED_HEIGHT,
    expectedWidth: PANEL_WIDTH,
    width: PANEL_WIDTH_CLASS,
  });
  const { open, toggle } = dropdown;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel={PANEL_LABEL}
      className="flex flex-col bg-subtle"
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
          <ListFilter size={ICON_SIZE.control} aria-hidden className="shrink-0" />
          {hiddenCount > 0 ? hiddenCount : null}
        </button>
      }
    >
      <ScrollFade
        className="max-h-80"
        viewportClassName="flex flex-col gap-2 py-2"
        fadeSize={12}
        fadeFrom="subtle"
      >
        {ACTIVITY_CATEGORIES.map((category) => {
          const toggles = childTogglesOf({ category });
          return (
            <div key={category} className="flex flex-col gap-1">
              <CategoryRow category={category} isActive={filter[category]} onToggle={onToggle} />
              {toggles.length > 0 ? (
                <ChildChipRow
                  toggles={toggles}
                  filter={filter}
                  isParentActive={filter[category]}
                  onToggle={onToggle}
                />
              ) : null}
            </div>
          );
        })}
      </ScrollFade>
      <Divider />
      <PopoverFooter className="flex items-center gap-1 bg-subtle px-1.5 py-1">
        <button
          type="button"
          role="menuitem"
          onClick={() => onAll({ enabled: true })}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-2xs text-muted-foreground hover:bg-muted/40 hover:text-foreground motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)]"
        >
          <Eye size={11} aria-hidden className="shrink-0" />
          Show all
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => onAll({ enabled: false })}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-2xs text-muted-foreground hover:bg-muted/40 hover:text-foreground motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)]"
        >
          <EyeOff size={11} aria-hidden className="shrink-0" />
          Hide all
        </button>
      </PopoverFooter>
    </AnchoredPopover>
  );
};

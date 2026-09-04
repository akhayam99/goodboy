import { CornerDownRight, Eye, EyeOff, ListFilter } from 'lucide-react';
import { AnchoredPopover, Divider, cn, tintClasses, useDropdown } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../../shared/components/conceptIcons';
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_CATEGORY_LABEL,
  ACTIVITY_SUBAGENT_PARENT,
  ACTIVITY_SUBAGENT_TOGGLES,
  type ActivityCategory,
  type ActivityFilter,
  type ActivitySubagentToggle,
  type ActivityToggle,
} from '../../../../timeline/activityFilter';

const ACTIVITY_CATEGORY_CONCEPT = {
  suggestions: 'suggestion',
  worktree: 'branch',
  issues: 'issues',
  pullRequests: 'pr',
  workflows: 'workflows',
  plans: 'plans',
  agents: 'agents',
  questions: 'questions',
  resolver: 'resolve',
  decisions: 'decisions',
} satisfies Record<ActivityCategory, keyof typeof CONCEPT_ICONS>;

const SUBAGENT_ROW_LABEL: Record<ActivitySubagentToggle, string> = {
  workflowSubagents: 'Workflow subagents',
  agentSubagents: 'Agent subagents',
};

const PANEL_LABEL = 'Activity filter';

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
      size={12}
      aria-hidden
      className="shrink-0 text-muted-foreground motion-safe:transition-colors group-hover:text-foreground"
    />
  ) : (
    <EyeOff
      size={12}
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
        'group flex w-full items-center gap-2 px-3 py-1.5 text-left motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)]',
        isActive ? 'bg-muted/60 hover:bg-muted' : 'hover:bg-muted/40',
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
          'flex-1 whitespace-nowrap text-xs motion-safe:transition-colors',
          isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground',
        )}
      >
        {ACTIVITY_CATEGORY_LABEL[category]}
      </span>
      <EyeMark isActive={isActive} />
    </button>
  );
};

type SubagentRowProps = {
  readonly toggle: ActivitySubagentToggle;
  readonly isActive: boolean;
  readonly isParentActive: boolean;
  readonly onToggle: Props['onToggle'];
};

const SubagentRow = ({ toggle, isActive, isParentActive, onToggle }: SubagentRowProps) => {
  const isOn = isActive && isParentActive;
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={isOn}
      aria-label={SUBAGENT_ROW_LABEL[toggle]}
      disabled={!isParentActive}
      onClick={() => onToggle({ toggle, enabled: !isActive })}
      className={cn(
        'group flex w-full items-center gap-2 py-1 pl-7 pr-3 text-left motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)]',
        isParentActive ? (isOn ? 'bg-muted/60 hover:bg-muted' : 'hover:bg-muted/40') : 'opacity-50',
      )}
    >
      <CornerDownRight
        size={10}
        aria-hidden
        className={cn('shrink-0', isOn ? 'text-muted-foreground' : 'text-muted-foreground/50')}
      />
      <span
        className={cn(
          'flex-1 whitespace-nowrap text-2xs motion-safe:transition-colors',
          isOn ? 'text-foreground' : 'text-muted-foreground',
          isParentActive && 'group-hover:text-foreground',
        )}
      >
        Subagents
      </span>
      <EyeMark isActive={isOn} />
    </button>
  );
};

const SUBAGENT_ROW_AFTER = Object.fromEntries(
  ACTIVITY_SUBAGENT_TOGGLES.map((toggle) => [ACTIVITY_SUBAGENT_PARENT[toggle], toggle]),
) as Partial<Record<ActivityCategory, ActivitySubagentToggle>>;

export const ActivityFilterButton = ({ filter, hiddenCount, onToggle, onAll }: Props) => {
  const dropdown = useDropdown({
    align: 'end',
    expectedHeight: 372,
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
        const subagentToggle = SUBAGENT_ROW_AFTER[category];
        return (
          <div key={category}>
            <CategoryRow category={category} isActive={filter[category]} onToggle={onToggle} />
            {subagentToggle != null && (
              <SubagentRow
                toggle={subagentToggle}
                isActive={filter[subagentToggle]}
                isParentActive={filter[category]}
                onToggle={onToggle}
              />
            )}
          </div>
        );
      })}
      <Divider className="my-1" />
      <div className="flex items-center gap-1 px-1.5 py-0.5">
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
      </div>
    </AnchoredPopover>
  );
};

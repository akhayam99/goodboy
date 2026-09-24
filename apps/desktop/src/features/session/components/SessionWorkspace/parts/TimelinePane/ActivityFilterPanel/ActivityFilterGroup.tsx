import { Eyebrow, cn, tintClasses } from '@goodboy/ui';
import {
  CONCEPT_ICONS,
  CONCEPT_TONE,
  ICON_SIZE,
} from '../../../../../../../shared/components/conceptIcons';
import {
  ACTIVITY_CATEGORY_LABEL,
  ACTIVITY_CHILD,
  ACTIVITY_CHILD_TOGGLES,
  type ActivityCategory,
  type ActivityCounts,
  type ActivityFilter,
  type ActivityToggle,
} from '../../../../../timeline/activityFilter';
import { ActivityFilterOption } from './ActivityFilterOption';

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

type Props = {
  readonly label: string;
  readonly categories: ReadonlyArray<ActivityCategory>;
  readonly filter: ActivityFilter;
  readonly counts: ActivityCounts;
  readonly onToggle: (params: {
    readonly toggle: ActivityToggle;
    readonly enabled: boolean;
  }) => void;
};

export const ActivityFilterGroup = ({ label, categories, filter, counts, onToggle }: Props) => (
  <div role="group" aria-label={label} className="flex min-w-0 flex-col gap-1">
    <Eyebrow label={label} muted className="px-1.5" />
    <div className="flex flex-col">
      {categories.map((category) => {
        const concept = ACTIVITY_CATEGORY_CONCEPT[category];
        const Icon = CONCEPT_ICONS[concept];
        const isShown = filter[category];
        const children = ACTIVITY_CHILD_TOGGLES.filter(
          (toggle) => ACTIVITY_CHILD[toggle].parent === category,
        );
        return (
          <div key={category} className="flex flex-col">
            <ActivityFilterOption
              label={ACTIVITY_CATEGORY_LABEL[category]}
              ariaLabel={ACTIVITY_CATEGORY_LABEL[category]}
              count={counts[category]}
              isChecked={isShown}
              icon={
                <Icon
                  size={ICON_SIZE.row}
                  aria-hidden
                  className={cn(
                    'shrink-0',
                    isShown ? tintClasses(CONCEPT_TONE[concept]).icon : 'text-faint-foreground',
                  )}
                />
              }
              onChange={(enabled) => onToggle({ toggle: category, enabled })}
            />
            {children.map((toggle) => (
              <ActivityFilterOption
                key={toggle}
                label={ACTIVITY_CHILD[toggle].label}
                ariaLabel={ACTIVITY_CHILD[toggle].ariaLabel}
                count={counts[toggle]}
                isChecked={isShown && filter[toggle]}
                isDisabled={!isShown}
                isChild
                onChange={(enabled) => onToggle({ toggle, enabled })}
              />
            ))}
          </div>
        );
      })}
    </div>
  </div>
);

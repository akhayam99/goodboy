import { ClampedProse, SegmentedTabs, SelectableRow } from '@goodboy/ui';
import type { PullRequestNouns } from '@goodboy/types';
import { useNow } from '../../hooks/useNow';
import { formatAge } from '../../utils/time/formatAge';
import { ActivityBotNotes } from './ActivityBotNotes';
import { ActivityLeadMark } from './ActivityLeadMark';
import { activityFilterOptionsOf, activityItemsFor, type ActivityFilter } from './activityFilters';
import type { ActivityItem } from './activityItem';
import { activityRowOf } from './activityRowOf';

type Props = {
  readonly items: ReadonlyArray<ActivityItem>;
  readonly nouns: PullRequestNouns;
  readonly baseBranch: string;
  readonly onOpenComments: () => void;
  readonly onOpenChecks: () => void;
  readonly chosen: ActivityFilter;
  readonly onChoose: (filter: ActivityFilter) => void;
  readonly isHeadingShown?: boolean;
};

const ROW = 'grid min-w-0 grid-cols-[1.5rem_minmax(0,1fr)_auto] items-start gap-x-2 gap-y-2';

export const PullRequestActivity = ({
  items: allItems,
  nouns,
  baseBranch,
  onOpenComments,
  onOpenChecks,
  chosen,
  onChoose,
  isHeadingShown = true,
}: Props) => {
  const now = useNow(60_000);
  const options = activityFilterOptionsOf({ items: allItems });
  const filter = options.some((option) => option.value === chosen) ? chosen : 'all';
  const items = activityItemsFor({ items: allItems, filter });
  return (
    <section
      aria-label={isHeadingShown ? 'Activity' : undefined}
      className="flex min-w-0 flex-col gap-2"
    >
      <div className="flex min-h-5 min-w-0 items-center justify-between gap-2">
        {isHeadingShown ? <h2 className="text-row text-muted-foreground">Activity</h2> : <span />}
        {options.length > 2 ? (
          <SegmentedTabs
            size="xs"
            ariaLabel="Activity filter"
            value={filter}
            onChange={onChoose}
            options={options.map((option) => ({
              value: option.value,
              label: option.label,
              badge: option.count,
            }))}
          />
        ) : null}
      </div>
      <ol className="relative flex min-w-0 flex-col gap-3">
        <span
          aria-hidden
          data-slot="activity-spine"
          className="absolute inset-y-1 left-[11px] w-0.5 bg-border-soft"
        />
        {items.map((item) => {
          const row = activityRowOf({ item, nouns, baseBranch, onOpenComments, onOpenChecks });
          const age = formatAge({ from: item.at, now });
          const head = (
            <>
              <ActivityLeadMark lead={row.lead} />
              <span className="min-w-0 py-0.5 text-ui text-muted-foreground">{row.line}</span>
              <span className="flex shrink-0 items-center gap-2 py-0.5">
                {row.open === null ? null : (
                  <span className="text-meta text-faint-foreground">{row.open.label}</span>
                )}
                {age === '' ? null : (
                  <time dateTime={item.at} className="text-meta tabular-nums text-faint-foreground">
                    {age}
                  </time>
                )}
              </span>
            </>
          );
          return (
            <li
              key={item.key}
              data-activity={item.kind}
              className="relative flex min-w-0 flex-col gap-2"
            >
              {row.open === null ? (
                <div className={ROW}>{head}</div>
              ) : (
                <SelectableRow selected={false} onClick={row.open.run} className={ROW}>
                  {head}
                </SelectableRow>
              )}
              {row.notes === undefined ? null : (
                <div className="min-w-0 pl-8">
                  <ActivityBotNotes notes={row.notes} />
                </div>
              )}
              {row.comments.length === 0 ? null : (
                <ul className="flex min-w-0 flex-col gap-2 pl-8">
                  {row.comments.map((comment, position) => (
                    <li
                      key={position}
                      className="min-w-0 rounded-lg border border-border-soft bg-background px-3 py-2 text-body text-foreground"
                    >
                      <ClampedProse text={comment.text} lines={4} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
};

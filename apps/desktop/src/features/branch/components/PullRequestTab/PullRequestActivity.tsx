import { ClampedProse, SectionHeader, SegmentedTabs, SelectableRow } from '@goodboy/ui';
import type { PullRequestNouns } from '@goodboy/types';
import { useNow } from '../../../../shared/hooks/useNow';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { ActivityBotNotes } from './ActivityBotNotes';
import { activityFilterOptionsOf, activityItemsFor, type ActivityFilter } from './activityFilters';
import type { ActivityItem } from './activityOf';
import { activityRowOf } from './activityRowOf';

type Props = {
  readonly items: ReadonlyArray<ActivityItem>;
  readonly nouns: PullRequestNouns;
  readonly baseBranch: string;
  readonly onOpenComments: () => void;
  readonly onOpenChecks: () => void;
  readonly chosen: ActivityFilter;
  readonly onChoose: (filter: ActivityFilter) => void;
};

export const PullRequestActivity = ({
  items: allItems,
  nouns,
  baseBranch,
  onOpenComments,
  onOpenChecks,
  chosen,
  onChoose,
}: Props) => {
  const now = useNow(60_000);
  const options = activityFilterOptionsOf({ items: allItems });
  const filter = options.some((option) => option.value === chosen) ? chosen : 'all';
  const items = activityItemsFor({ items: allItems, filter });
  return (
    <section aria-label="Activity" className="flex min-w-0 flex-col gap-3">
      <SectionHeader
        label="Activity"
        headingLevel={2}
        action={
          options.length > 2 ? (
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
          ) : null
        }
      />
      <ol className="flex min-w-0 flex-col">
        {items.map((item, index) => {
          const row = activityRowOf({ item, nouns, baseBranch, onOpenComments, onOpenChecks });
          const age = formatAge({ from: item.at, now });
          const content = (
            <>
              <span className="relative flex size-5 shrink-0 items-center justify-center rounded-full bg-subtle text-muted-foreground">
                {row.glyph}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex min-w-0 items-center gap-2 text-meta text-muted-foreground">
                  <span className="min-w-0 flex-1">{row.line}</span>
                  {row.open !== null && (
                    <span className="shrink-0 text-meta text-faint-foreground">
                      {row.open.label}
                    </span>
                  )}
                  {age !== '' && (
                    <time
                      dateTime={item.at}
                      className="shrink-0 text-meta tabular-nums text-faint-foreground"
                    >
                      {age}
                    </time>
                  )}
                </span>
                {row.notes === undefined ? null : <ActivityBotNotes notes={row.notes} />}
                {row.comments.length === 0 ? null : (
                  <ul className="flex min-w-0 flex-col gap-2">
                    {row.comments.map((comment, position) => (
                      <li
                        key={position}
                        className="flex min-w-0 flex-col gap-1 rounded-md bg-subtle px-3 py-2"
                      >
                        <span className="min-w-0 text-meta text-foreground">
                          <ClampedProse text={comment.text} lines={2} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </span>
            </>
          );
          return (
            <li key={item.key} data-activity={item.kind} className="relative min-w-0">
              {index === items.length - 1 ? null : (
                <span
                  aria-hidden
                  data-slot="activity-spine"
                  className="absolute bottom-0 left-4.5 top-6 w-px bg-border-soft"
                />
              )}
              {row.open === null ? (
                <div className="flex min-h-8 min-w-0 items-start gap-2 px-2 py-1">{content}</div>
              ) : (
                <SelectableRow
                  selected={false}
                  onClick={row.open.run}
                  className="min-h-8 min-w-0 items-start gap-2 px-2 py-1"
                >
                  {content}
                </SelectableRow>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
};

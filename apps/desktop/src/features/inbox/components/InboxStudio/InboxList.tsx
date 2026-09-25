import { Button, EmptyState, Eyebrow, Notice, Skeleton } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import type { DayGroup } from '../../../../shared/utils/groupByDay';
import { integrationLabel } from '../../../integrations/components/IntegrationGlyph';
import type { InboxProvider, InboxRecord } from '../../types';
import { InboxRow, inboxOptionId } from './InboxRow';

export type InboxLoadFailure = {
  readonly provider: InboxProvider;
  readonly message: string;
};

type Props = {
  readonly days: ReadonlyArray<DayGroup<InboxRecord>>;
  readonly totalCount: number;
  readonly connectedCount: number;
  readonly isLoading: boolean;
  readonly failures: ReadonlyArray<InboxLoadFailure>;
  readonly hasFiltersActive: boolean;
  readonly selectedKey: string | null;
  readonly onSelect: (record: InboxRecord) => void;
  readonly onRetry: () => void;
  readonly onOpenSettings: () => void;
  readonly onClearFilters: () => void;
};

type FailureTitleParams = {
  readonly failures: ReadonlyArray<InboxLoadFailure>;
};

const failureTitle = ({ failures }: FailureTitleParams): string => {
  const names = failures.map((failure) => integrationLabel({ provider: failure.provider }));
  if (names.length <= 1) {
    return `${names[0] ?? 'A tool'} didn't load.`;
  }
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1] ?? ''} didn't load.`;
};

export const InboxList = ({
  days,
  totalCount,
  connectedCount,
  isLoading,
  failures,
  hasFiltersActive,
  selectedKey,
  onSelect,
  onRetry,
  onOpenSettings,
  onClearFilters,
}: Props) => {
  const visibleCount = days.reduce((sum, day) => sum + day.items.length, 0);
  const isShowingSkeleton = isLoading && totalCount === 0;
  const activeOptionId =
    selectedKey != null &&
    days.some((day) => day.items.some((record) => record.key === selectedKey))
      ? inboxOptionId({ key: selectedKey })
      : undefined;
  const firstFailure = failures[0];

  return (
    <div className="flex flex-col gap-4">
      {firstFailure != null ? (
        <Notice
          tone="warning"
          placement="inline"
          title={failureTitle({ failures })}
          body={failures.length === 1 ? firstFailure.message : undefined}
          detail={
            failures.length > 1
              ? failures
                  .map(
                    (failure) =>
                      `${integrationLabel({ provider: failure.provider })}: ${failure.message}`,
                  )
                  .join('\n')
              : null
          }
          actions={
            <>
              <Button variant="ghost" size="sm" onClick={onRetry}>
                Retry
              </Button>
              <Button variant="ghost" size="sm" onClick={onOpenSettings}>
                Open settings
              </Button>
            </>
          }
        />
      ) : null}
      {isShowingSkeleton ? (
        <div className="flex flex-col gap-0.5" role="status" aria-label="Loading the inbox">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex h-8 items-center gap-2.5 px-2.5">
              <Skeleton className="size-3.5 shrink-0 rounded-full" />
              <Skeleton className="h-3 w-16 shrink-0 rounded-sm" />
              <Skeleton className="h-3 flex-1 rounded-sm" />
            </div>
          ))}
        </div>
      ) : null}
      {!isShowingSkeleton && connectedCount === 0 && totalCount === 0 ? (
        <EmptyState
          icon={CONCEPT_ICONS.inbox}
          tone={CONCEPT_TONE.inbox}
          title="Connect a tool to fill the inbox"
          description="Issues, pull requests, threads and errors assigned to you land here."
          action={
            <Button variant="secondary" size="sm" onClick={onOpenSettings}>
              Connect a tool
            </Button>
          }
          size="lg"
          headingLevel={2}
        />
      ) : null}
      {!isShowingSkeleton && connectedCount > 0 && totalCount === 0 && failures.length === 0 ? (
        <EmptyState
          icon={CONCEPT_ICONS.inbox}
          tone={CONCEPT_TONE.inbox}
          title="Nothing assigned to you"
          description="Connected tools have no open issues, reviews, threads or errors for you."
          size="lg"
          headingLevel={2}
        />
      ) : null}
      {totalCount > 0 && visibleCount === 0 ? (
        <EmptyState
          icon={CONCEPT_ICONS.inbox}
          tone={CONCEPT_TONE.inbox}
          title="No items match these filters"
          action={
            hasFiltersActive ? (
              <Button variant="secondary" size="sm" onClick={onClearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
          size="lg"
          headingLevel={2}
        />
      ) : null}
      {visibleCount > 0 ? (
        <ul
          tabIndex={0}
          role="listbox"
          aria-label="Inbox items"
          aria-activedescendant={activeOptionId}
          className="flex flex-col gap-4 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {days.map((day) => (
            <li key={day.day} role="presentation" className="flex flex-col gap-0.5">
              <div role="presentation" className="flex items-baseline gap-1.5 px-2.5 pb-1">
                <Eyebrow label={day.label} />
                <span className="text-2xs tabular-nums text-faint-foreground">
                  {day.items.length}
                </span>
              </div>
              <ul role="group" aria-label={day.label} className="flex flex-col gap-px">
                {day.items.map((record) => (
                  <li key={record.key} role="presentation">
                    <InboxRow
                      record={record}
                      selected={record.key === selectedKey}
                      onSelect={onSelect}
                    />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

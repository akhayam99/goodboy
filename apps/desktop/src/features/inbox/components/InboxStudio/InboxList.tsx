import { Button, EmptyLine, EmptyState, Eyebrow, Notice, Skeleton } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { DayGroup } from '../../../../shared/utils/groupByDay';
import { integrationLabel } from '../../../integrations/components/IntegrationGlyph';
import type { InboxProvider, InboxRecord } from '../../types';
import { hasMixedStates } from './hasMixedStates';
import { inboxFailureNoticeOf } from './inboxFailureNotice';
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
  readonly onActivate?: (record: InboxRecord) => void;
  readonly onRetry: () => void;
  readonly onOpenSettings: () => void;
  readonly onClearFilters: () => void;
  readonly starOf?: (record: InboxRecord) => boolean | undefined;
  readonly onToggleStar?: (record: InboxRecord) => void;
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
  onActivate,
  onRetry,
  onOpenSettings,
  onClearFilters,
  starOf,
  onToggleStar,
}: Props) => {
  const visibleCount = days.reduce((sum, day) => sum + day.items.length, 0);
  const isStateShown = hasMixedStates({ records: days.flatMap((day) => day.items) });
  const isShowingSkeleton = isLoading && totalCount === 0;
  const activeOptionId =
    selectedKey != null &&
    days.some((day) => day.items.some((record) => record.key === selectedKey))
      ? inboxOptionId({ key: selectedKey })
      : undefined;
  const failureNotice = inboxFailureNoticeOf({
    failures: failures.map((failure) => ({
      name: integrationLabel({ provider: failure.provider }),
      message: failure.message,
    })),
  });

  return (
    <div className="flex flex-col gap-4">
      {failureNotice !== null ? (
        <Notice
          tone={failureNotice.tone}
          placement="inline"
          role="alert"
          title={failureNotice.title}
          body={failureNotice.body}
          detail={failureNotice.detail}
          actions={
            <>
              <Button variant="secondary" size="sm" onClick={onRetry}>
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
        <div className="flex flex-col gap-0.5" role="status" aria-label="Loading tasks">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex h-8 items-center gap-3 px-3">
              <Skeleton className="size-3.5 shrink-0 rounded-full" />
              <Skeleton className="h-3 w-16 shrink-0 rounded-sm" />
              <Skeleton className="h-3 flex-1 rounded-sm" />
            </div>
          ))}
        </div>
      ) : null}
      {!isShowingSkeleton && connectedCount === 0 && totalCount === 0 ? (
        <EmptyState
          size="page"
          icon={CONCEPT_ICONS.inbox}
          title="No tool connected"
          description="Connect a tool to see what is assigned to you."
          action={
            <Button variant="primary" size="sm" onClick={onOpenSettings}>
              Connect a tool
            </Button>
          }
        />
      ) : null}
      {!isShowingSkeleton && connectedCount > 0 && totalCount === 0 && failures.length === 0 ? (
        <EmptyState
          size="page"
          icon={CONCEPT_ICONS.inbox}
          title="No items yet"
          description="Issues and errors assigned to you in your tools are listed here."
        />
      ) : null}
      {totalCount > 0 && visibleCount === 0 ? (
        <EmptyLine
          action={
            hasFiltersActive ? (
              <Button variant="ghost" size="xs" onClick={onClearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        >
          No items match these filters.
        </EmptyLine>
      ) : null}
      {visibleCount > 0 ? (
        <ul
          tabIndex={0}
          role="listbox"
          aria-label="Task items"
          aria-activedescendant={activeOptionId}
          className="flex flex-col gap-4 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {days.map((day) => (
            <li key={day.day} role="presentation" className="flex flex-col gap-0.5">
              <div role="presentation" className="flex items-baseline gap-2 px-3 pb-1">
                <Eyebrow label={day.label} />
                <span className="text-meta tabular-nums text-faint-foreground">
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
                      onActivate={onActivate}
                      isStarred={starOf?.(record)}
                      onToggleStar={onToggleStar}
                      isStateShown={isStateShown}
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

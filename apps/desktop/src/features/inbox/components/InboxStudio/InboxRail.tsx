import { Bug, CircleDot, GitPullRequest, MessagesSquare, Search } from 'lucide-react';
import {
  Button,
  cn,
  EmptyState,
  ErrorStrip,
  ScrollFade,
  SegmentedTabs,
  Skeleton,
  Tooltip,
  PANE_RHYTHM,
  type SegmentedTabOption,
} from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import {
  IntegrationGlyph,
  integrationLabel,
} from '../../../integrations/components/IntegrationGlyph';
import { INBOX_KIND_FILTERS, kindFilterCounts, type InboxKindFilter } from '../../kindFilter';
import type { InboxProvider, InboxRecord } from '../../types';
import { InboxRow } from './InboxRow';

const KIND_LABEL: Record<InboxKindFilter, string> = {
  all: 'All',
  issue: 'Issues',
  'pr-mr': 'PRs & MRs',
  thread: 'Threads',
  error: 'Errors',
};

const KIND_ICON: Record<InboxKindFilter, SegmentedTabOption<InboxKindFilter>['icon']> = {
  all: CONCEPT_ICONS.inbox,
  issue: CircleDot,
  'pr-mr': GitPullRequest,
  thread: MessagesSquare,
  error: Bug,
};

type ErrorEntry = {
  readonly provider: InboxProvider;
  readonly message: string;
};

type Props = {
  readonly records: ReadonlyArray<InboxRecord>;
  readonly totalCount: number;
  readonly availableProviders: ReadonlyArray<InboxProvider>;
  readonly selectedProviders: ReadonlySet<InboxProvider>;
  readonly onToggleProvider: (provider: InboxProvider) => void;
  readonly allRecords: ReadonlyArray<InboxRecord>;
  readonly query: string;
  readonly onQueryChange: (value: string) => void;
  readonly kindFilter: InboxKindFilter;
  readonly onKindFilterChange: (value: InboxKindFilter) => void;
  readonly selectedKey: string | null;
  readonly onSelect: (record: InboxRecord) => void;
  readonly isLoading: boolean;
  readonly errors: ReadonlyArray<ErrorEntry>;
  readonly onRefresh: () => void;
  readonly onOpenIntegrations: () => void;
  readonly onClearFilters: () => void;
};

export const InboxRail = ({
  records,
  totalCount,
  availableProviders,
  selectedProviders,
  onToggleProvider,
  allRecords,
  query,
  onQueryChange,
  kindFilter,
  onKindFilterChange,
  selectedKey,
  onSelect,
  isLoading,
  errors,
  onRefresh,
  onOpenIntegrations,
  onClearFilters,
}: Props) => {
  const counts = kindFilterCounts({ records: allRecords });
  const kindOptions: ReadonlyArray<SegmentedTabOption<InboxKindFilter>> = INBOX_KIND_FILTERS.map(
    (filter) => ({
      value: filter,
      label: KIND_LABEL[filter],
      icon: KIND_ICON[filter],
      badge: String(counts[filter]),
    }),
  );
  const hasFiltersActive =
    query.trim() !== '' || kindFilter !== 'all' || selectedProviders.size > 0;
  const isShowingSkeleton = isLoading && totalCount === 0;

  return (
    <div className="flex h-full flex-col">
      <div className={cn('shrink-0 flex flex-col gap-2.5', PANE_RHYTHM.rail.header)}>
        <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-background px-2.5 focus-within:border-primary">
          <Search size={13} aria-hidden className="shrink-0 text-muted-foreground/60" />
          <input
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search the inbox…"
            aria-label="Search the inbox"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
          />
        </div>
        <SegmentedTabs
          ariaLabel="Inbox kind filter"
          options={kindOptions}
          value={kindFilter}
          onChange={onKindFilterChange}
          size="sm"
        />
        {availableProviders.length > 0 ? (
          <div role="group" aria-label="Filter by provider" className="flex flex-wrap gap-1">
            {availableProviders.map((provider) => {
              const label = integrationLabel({ provider });
              const isActive = selectedProviders.has(provider);
              return (
                <Tooltip key={provider} content={label}>
                  <button
                    type="button"
                    onClick={() => onToggleProvider(provider)}
                    aria-label={label}
                    aria-pressed={isActive}
                    className={cn(
                      'flex items-center justify-center rounded-md border p-1.5 motion-safe:transition-colors',
                      isActive
                        ? 'border-primary/40 bg-primary/10'
                        : 'border-border-soft hover:border-border hover:bg-muted/50',
                    )}
                  >
                    <IntegrationGlyph provider={provider} size="xs" useBrandColor />
                  </button>
                </Tooltip>
              );
            })}
          </div>
        ) : null}
      </div>

      {isShowingSkeleton ? (
        <div
          className="flex min-h-0 flex-1 flex-col gap-1.5 px-3 pb-3"
          role="status"
          aria-label="Loading the inbox"
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-1 px-2.5 py-2">
              <div className="flex items-center gap-2">
                <Skeleton className="size-3.5 shrink-0 rounded-full" />
                <Skeleton className="h-3 flex-1 rounded" />
              </div>
              <div className="flex items-center gap-2">
                <span aria-hidden className="size-3.5 shrink-0" />
                <Skeleton className="h-2.5 w-1/3 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : totalCount === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-3">
          <EmptyState
            icon={CONCEPT_ICONS.inbox}
            tone={CONCEPT_TONE.inbox}
            title="Nothing in your inbox yet"
            description="Connect a provider to see issues, pull requests, merge requests, threads and errors here."
            size="inline"
            action={
              <Button variant="ghost" size="sm" onClick={onOpenIntegrations}>
                Open integrations
              </Button>
            }
          />
        </div>
      ) : records.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-3">
          <EmptyState
            icon={Search}
            tone="neutral"
            title="No matching items"
            description="Your filters are hiding everything in the inbox."
            size="inline"
            action={
              <Button variant="ghost" size="sm" onClick={onClearFilters}>
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
          <div className={cn('flex flex-col gap-0.5', PANE_RHYTHM.rail.body)}>
            {errors.length > 0 ? (
              <div className="flex flex-col gap-1.5 pb-1.5">
                {errors.map((entry) => (
                  <ErrorStrip
                    key={entry.provider}
                    label={integrationLabel({ provider: entry.provider })}
                    error={new Error(entry.message)}
                    onRetry={onRefresh}
                  />
                ))}
              </div>
            ) : null}
            <ul className="flex flex-col gap-0.5">
              {records.map((record) => (
                <li key={record.key}>
                  <InboxRow
                    record={record}
                    selected={record.key === selectedKey}
                    onSelect={onSelect}
                  />
                </li>
              ))}
            </ul>
            {hasFiltersActive ? (
              <p className="px-1 pt-1 text-2xs text-muted-foreground/60">
                {records.length} of {totalCount} shown
              </p>
            ) : null}
          </div>
        </ScrollFade>
      )}
    </div>
  );
};

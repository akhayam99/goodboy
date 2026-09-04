import { Fragment, type KeyboardEvent } from 'react';
import { Bug, CircleDot, GitPullRequest, MessagesSquare, Search } from 'lucide-react';
import {
  Chip,
  cn,
  ErrorStrip,
  Eyebrow,
  KbdPill,
  PANE_RHYTHM,
  ScrollFade,
  SegmentedTabs,
  Skeleton,
  type SegmentedTabOption,
} from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import {
  IntegrationGlyph,
  integrationLabel,
} from '../../../integrations/components/IntegrationGlyph';
import { groupRecordsByAge } from '../../ageSections';
import {
  filterInboxRecords,
  INBOX_KIND_FILTERS,
  kindFilterCounts,
  type InboxKindFilter,
} from '../../kindFilter';
import { INBOX_PROVIDERS, type InboxProvider, type InboxRecord } from '../../types';
import { InboxRow, inboxOptionId } from './InboxRow';

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

const NO_PROVIDER_FILTER: ReadonlySet<InboxProvider> = new Set();

type ErrorEntry = {
  readonly provider: InboxProvider;
  readonly message: string;
};

type Props = {
  readonly records: ReadonlyArray<InboxRecord>;
  readonly allRecords: ReadonlyArray<InboxRecord>;
  readonly selectedProviders: ReadonlySet<InboxProvider>;
  readonly onToggleProvider: (provider: InboxProvider) => void;
  readonly query: string;
  readonly onQueryChange: (value: string) => void;
  readonly kindFilter: InboxKindFilter;
  readonly onKindFilterChange: (value: InboxKindFilter) => void;
  readonly selectedKey: string | null;
  readonly onSelect: (record: InboxRecord) => void;
  readonly onActivate: (record: InboxRecord) => void;
  readonly onClearFilters: () => void;
  readonly isLoading: boolean;
  readonly errors: ReadonlyArray<ErrorEntry>;
  readonly onRefresh: () => void;
};

type ListKeyDownParams = {
  readonly event: KeyboardEvent<HTMLUListElement>;
  readonly orderedRecords: ReadonlyArray<InboxRecord>;
  readonly selectedKey: string | null;
  readonly onSelect: (record: InboxRecord) => void;
  readonly onActivate: (record: InboxRecord) => void;
};

const handleListKeyDown = ({
  event,
  orderedRecords,
  selectedKey,
  onSelect,
  onActivate,
}: ListKeyDownParams): void => {
  if (orderedRecords.length === 0) {
    return;
  }
  const selectedIndex = orderedRecords.findIndex((record) => record.key === selectedKey);
  if (event.key === 'Enter') {
    const selectedRecord = selectedIndex < 0 ? null : (orderedRecords[selectedIndex] ?? null);
    if (selectedRecord == null) {
      return;
    }
    event.preventDefault();
    onActivate(selectedRecord);
    return;
  }
  const lastIndex = orderedRecords.length - 1;
  const nextIndex = ((): number | null => {
    if (event.key === 'ArrowDown') {
      return selectedIndex < 0 ? 0 : Math.min(selectedIndex + 1, lastIndex);
    }
    if (event.key === 'ArrowUp') {
      return selectedIndex < 0 ? lastIndex : Math.max(selectedIndex - 1, 0);
    }
    if (event.key === 'Home') {
      return 0;
    }
    if (event.key === 'End') {
      return lastIndex;
    }
    return null;
  })();
  if (nextIndex == null) {
    return;
  }
  event.preventDefault();
  const nextRecord = orderedRecords[nextIndex];
  if (nextRecord == null) {
    return;
  }
  onSelect(nextRecord);
};

export const InboxRail = ({
  records,
  allRecords,
  selectedProviders,
  onToggleProvider,
  query,
  onQueryChange,
  kindFilter,
  onKindFilterChange,
  selectedKey,
  onSelect,
  onActivate,
  onClearFilters,
  isLoading,
  errors,
  onRefresh,
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
  const providerCountRecords = filterInboxRecords({
    records: allRecords,
    query,
    kindFilter,
    providers: NO_PROVIDER_FILTER,
  });
  const providers = INBOX_PROVIDERS.filter(
    (provider) =>
      selectedProviders.has(provider) || allRecords.some((record) => record.provider === provider),
  );
  const sections = groupRecordsByAge({ records });
  const orderedRecords = sections.flatMap((section) => section.records);
  const totalCount = allRecords.length;
  const hasFiltersActive =
    query.trim() !== '' || kindFilter !== 'all' || selectedProviders.size > 0;
  const isShowingSkeleton = isLoading && totalCount === 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div
        className={cn(
          'sticky top-0 z-10 flex shrink-0 flex-col gap-2 border-b border-border-soft bg-background',
          PANE_RHYTHM.rail.header,
        )}
      >
        <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-background px-2.5 focus-within:border-primary">
          <Search size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground/60" />
          <input
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search the inbox"
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
          fill
        />
        {providers.length > 0 ? (
          <div role="group" aria-label="Filter by provider" className="flex flex-wrap gap-1.5">
            {providers.map((provider) => {
              const label = integrationLabel({ provider });
              const isActive = selectedProviders.has(provider);
              const count = providerCountRecords.filter(
                (record) => record.provider === provider,
              ).length;
              return (
                <Chip
                  key={provider}
                  as="button"
                  size="sm"
                  tone={isActive ? 'primary' : 'neutral'}
                  emphasis={isActive ? 'strong' : 'subtle'}
                  icon={<IntegrationGlyph provider={provider} size="xs" useBrandColor />}
                  label={label}
                  trailing={<span className="font-mono tabular-nums">{count}</span>}
                  ariaLabel={`${label}, ${count} ${count === 1 ? 'item' : 'items'}`}
                  ariaPressed={isActive}
                  onClick={() => onToggleProvider(provider)}
                />
              );
            })}
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-2 text-3xs text-muted-foreground/60">
          <span className="flex items-center gap-1.5">
            <KbdPill className="h-4 min-w-4 text-3xs">↑↓</KbdPill>
            <span>navigate</span>
            <KbdPill className="h-4 min-w-4 text-3xs">↵</KbdPill>
            <span>launch</span>
          </span>
          {hasFiltersActive ? (
            <button
              type="button"
              onClick={onClearFilters}
              className="text-2xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring)]"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      {isShowingSkeleton ? (
        <div
          className={cn('flex min-h-0 flex-1 flex-col gap-1.5', PANE_RHYTHM.rail.body)}
          role="status"
          aria-label="Loading the inbox"
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-1 px-3 py-2">
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
      ) : (
        <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
          <div className={cn('flex flex-col gap-2', PANE_RHYTHM.rail.body)}>
            {errors.length > 0 ? (
              <div className="flex flex-col gap-1.5">
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
            <ul
              tabIndex={0}
              role="listbox"
              aria-label="Inbox items"
              aria-activedescendant={
                selectedKey == null || !orderedRecords.some((record) => record.key === selectedKey)
                  ? undefined
                  : inboxOptionId({ key: selectedKey })
              }
              className="flex flex-col gap-0.5 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
              onKeyDown={(event) =>
                handleListKeyDown({ event, orderedRecords, selectedKey, onSelect, onActivate })
              }
            >
              {sections.map((section) => (
                <Fragment key={section.key}>
                  <li role="presentation" className="px-1 pb-0.5 pt-2.5 first:pt-0.5">
                    <Eyebrow label={section.label} muted />
                  </li>
                  {section.records.map((record) => (
                    <li key={record.key} role="presentation">
                      <InboxRow
                        record={record}
                        selected={record.key === selectedKey}
                        onSelect={onSelect}
                      />
                    </li>
                  ))}
                </Fragment>
              ))}
            </ul>
            {records.length === 0 ? (
              <p className="px-1 py-1 text-xs text-muted-foreground">
                {totalCount === 0 ? 'No inbox items' : 'No matching items'}
              </p>
            ) : null}
            {hasFiltersActive && records.length > 0 ? (
              <p className="px-1 text-2xs text-muted-foreground/60">
                {records.length} of {totalCount} shown
              </p>
            ) : null}
          </div>
        </ScrollFade>
      )}
    </div>
  );
};

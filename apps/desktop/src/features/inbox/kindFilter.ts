import { recordSessionId } from './recordSessionId';
import type { InboxKind, InboxProvider, InboxRecord } from './types';

export type InboxKindFilter = 'all' | 'issue' | 'pr-mr' | 'thread' | 'error';

export const INBOX_KIND_FILTERS: ReadonlyArray<InboxKindFilter> = [
  'all',
  'issue',
  'pr-mr',
  'thread',
  'error',
];

export type InboxTypeFacet = Exclude<InboxKindFilter, 'all'>;

export const INBOX_TYPE_FACETS: ReadonlyArray<InboxTypeFacet> = [
  'issue',
  'pr-mr',
  'thread',
  'error',
];

export const INBOX_KIND_PROVIDERS: Record<InboxTypeFacet, ReadonlyArray<InboxProvider>> = {
  issue: ['github', 'gitlab', 'linear', 'jira'],
  'pr-mr': ['gitlab', 'bitbucket'],
  thread: ['slack'],
  error: ['sentry'],
};

export type InboxView = 'all' | 'in-progress' | 'with-session' | 'closed';

export const INBOX_VIEWS: ReadonlyArray<InboxView> = [
  'all',
  'in-progress',
  'with-session',
  'closed',
];

export type InboxFilters = {
  readonly view: InboxView;
  readonly kind: InboxKindFilter;
  readonly source: InboxProvider | null;
};

export const NO_INBOX_FILTERS: InboxFilters = { view: 'all', kind: 'all', source: null };

type VisibleTypeFacetsParams = {
  readonly connected: ReadonlyArray<InboxProvider>;
};

export const visibleTypeFacets = ({
  connected,
}: VisibleTypeFacetsParams): ReadonlyArray<InboxTypeFacet> =>
  INBOX_TYPE_FACETS.filter((facet) =>
    INBOX_KIND_PROVIDERS[facet].some((provider) => connected.includes(provider)),
  );

type MatchesKindParams = {
  readonly kind: InboxKind;
  readonly filter: InboxKindFilter;
};

export const matchesKindFilter = ({ kind, filter }: MatchesKindParams): boolean => {
  switch (filter) {
    case 'all':
      return true;
    case 'issue':
      return kind === 'issue';
    case 'pr-mr':
      return kind === 'pr' || kind === 'mr';
    case 'thread':
      return kind === 'thread';
    case 'error':
      return kind === 'error';
    default: {
      const exhaustive: never = filter;
      return exhaustive;
    }
  }
};

type MatchesViewParams = {
  readonly record: InboxRecord;
  readonly view: InboxView;
};

export const matchesView = ({ record, view }: MatchesViewParams): boolean => {
  switch (view) {
    case 'all':
      return true;
    case 'in-progress':
      return record.state === 'active';
    case 'with-session':
      return recordSessionId({ record }) != null;
    case 'closed':
      return record.state === 'done';
    default: {
      const exhaustive: never = view;
      return exhaustive;
    }
  }
};

type MatchesSearchParams = {
  readonly record: InboxRecord;
  readonly query: string;
};

export const matchesSearch = ({ record, query }: MatchesSearchParams): boolean => {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return true;
  }
  return (
    record.title.toLowerCase().includes(needle) ||
    record.identifier.toLowerCase().includes(needle) ||
    record.context.toLowerCase().includes(needle)
  );
};

type MatchesFiltersParams = {
  readonly record: InboxRecord;
  readonly filters: InboxFilters;
};

const matchesFilters = ({ record, filters }: MatchesFiltersParams): boolean =>
  matchesView({ record, view: filters.view }) &&
  matchesKindFilter({ kind: record.kind, filter: filters.kind }) &&
  (filters.source == null || record.provider === filters.source);

type FilterRecordsParams = {
  readonly records: ReadonlyArray<InboxRecord>;
  readonly query: string;
  readonly filters: InboxFilters;
};

export const filterInboxRecords = ({
  records,
  query,
  filters,
}: FilterRecordsParams): ReadonlyArray<InboxRecord> =>
  records.filter(
    (record) => matchesFilters({ record, filters }) && matchesSearch({ record, query }),
  );

export type InboxFacetCounts = {
  readonly view: Readonly<Record<InboxView, number>>;
  readonly kind: Readonly<Record<InboxTypeFacet, number>>;
  readonly source: Readonly<Record<InboxProvider, number>>;
};

type FacetCountsParams = {
  readonly records: ReadonlyArray<InboxRecord>;
  readonly query: string;
  readonly filters: InboxFilters;
};

type SourceCountsParams = {
  readonly records: ReadonlyArray<InboxRecord>;
};

const sourceCounts = ({ records }: SourceCountsParams): Record<InboxProvider, number> => {
  const counts: Record<InboxProvider, number> = {
    github: 0,
    gitlab: 0,
    linear: 0,
    jira: 0,
    sentry: 0,
    slack: 0,
    bitbucket: 0,
  };
  for (const record of records) {
    counts[record.provider] += 1;
  }
  return counts;
};

export const inboxFacetCounts = ({
  records,
  query,
  filters,
}: FacetCountsParams): InboxFacetCounts => {
  const searched = records.filter((record) => matchesSearch({ record, query }));
  const forView = searched.filter((record) =>
    matchesFilters({ record, filters: { ...filters, view: 'all' } }),
  );
  const forKind = searched.filter((record) =>
    matchesFilters({ record, filters: { ...filters, kind: 'all' } }),
  );
  const forSource = searched.filter((record) =>
    matchesFilters({ record, filters: { ...filters, source: null } }),
  );
  const viewCount = (view: InboxView): number =>
    forView.filter((record) => matchesView({ record, view })).length;
  const kindCount = (filter: InboxTypeFacet): number =>
    forKind.filter((record) => matchesKindFilter({ kind: record.kind, filter })).length;
  return {
    view: {
      all: viewCount('all'),
      'in-progress': viewCount('in-progress'),
      'with-session': viewCount('with-session'),
      closed: viewCount('closed'),
    },
    kind: {
      issue: kindCount('issue'),
      'pr-mr': kindCount('pr-mr'),
      thread: kindCount('thread'),
      error: kindCount('error'),
    },
    source: sourceCounts({ records: forSource }),
  };
};

type ActiveCountParams = {
  readonly filters: InboxFilters;
};

export const activeFilterCount = ({ filters }: ActiveCountParams): number =>
  (filters.view === 'all' ? 0 : 1) +
  (filters.kind === 'all' ? 0 : 1) +
  (filters.source == null ? 0 : 1);

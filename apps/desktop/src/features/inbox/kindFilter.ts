import type { ProjectId } from '@goodboy/types';
import { isAssignedRecord } from './isForMeRecord';
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

const INBOX_TYPE_FACETS: ReadonlyArray<InboxTypeFacet> = ['issue', 'pr-mr', 'thread', 'error'];

export const INBOX_KIND_PROVIDERS: Record<InboxTypeFacet, ReadonlyArray<InboxProvider>> = {
  issue: ['github', 'gitlab', 'linear', 'jira'],
  'pr-mr': ['github', 'gitlab', 'bitbucket'],
  thread: ['slack'],
  error: ['sentry'],
};

export type InboxView = 'all' | 'assigned' | 'starred' | 'in-progress' | 'with-session' | 'closed';

export type InboxFilters = {
  readonly view: InboxView;
  readonly kind: InboxKindFilter;
  readonly source: InboxProvider | null;
  readonly project: ProjectId | null;
};

export const NO_INBOX_FILTERS: InboxFilters = {
  view: 'all',
  kind: 'all',
  source: null,
  project: null,
};

type MatchesProjectParams = {
  readonly record: InboxRecord;
  readonly project: ProjectId | null;
};

const PROJECT_MAPPED_PROVIDERS: ReadonlyArray<InboxProvider> = ['sentry', 'github', 'gitlab'];

type ProviderParams = {
  readonly provider: InboxProvider;
};

export const isProjectMappedProvider = ({ provider }: ProviderParams): boolean =>
  PROJECT_MAPPED_PROVIDERS.includes(provider);

const isTiedToProject = ({ record, project }: MatchesProjectParams): boolean =>
  project !== null && (record.projectIds ?? []).includes(project);

export const matchesProject = ({ record, project }: MatchesProjectParams): boolean => {
  if (project == null || !isProjectMappedProvider({ provider: record.provider })) {
    return true;
  }
  return isTiedToProject({ record, project });
};

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

type IsStarredRecord = (record: InboxRecord) => boolean;

const NEVER_STARRED: IsStarredRecord = () => false;

type MatchesViewParams = {
  readonly record: InboxRecord;
  readonly view: InboxView;
  readonly isStarred: IsStarredRecord;
};

const matchesView = ({ record, view, isStarred }: MatchesViewParams): boolean => {
  switch (view) {
    case 'all':
      return true;
    case 'assigned':
      return isAssignedRecord({ record });
    case 'starred':
      return isStarred(record);
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
  readonly isStarred: IsStarredRecord;
};

const matchesFilters = ({ record, filters, isStarred }: MatchesFiltersParams): boolean =>
  matchesView({ record, view: filters.view, isStarred }) &&
  matchesKindFilter({ kind: record.kind, filter: filters.kind }) &&
  (filters.source == null || record.provider === filters.source) &&
  matchesProject({ record, project: filters.project });

type FilterRecordsParams = {
  readonly records: ReadonlyArray<InboxRecord>;
  readonly query: string;
  readonly filters: InboxFilters;
  readonly isStarred?: IsStarredRecord;
};

export const filterInboxRecords = ({
  records,
  query,
  filters,
  isStarred = NEVER_STARRED,
}: FilterRecordsParams): ReadonlyArray<InboxRecord> =>
  records.filter(
    (record) => matchesFilters({ record, filters, isStarred }) && matchesSearch({ record, query }),
  );

export type InboxFacetCounts = {
  readonly view: Readonly<Record<InboxView, number>>;
  readonly kind: Readonly<Record<InboxTypeFacet, number>>;
  readonly source: Readonly<Record<InboxProvider, number>>;
  readonly project: (project: ProjectId) => number;
  readonly hasProjectMapping: boolean;
};

type FacetCountsParams = {
  readonly records: ReadonlyArray<InboxRecord>;
  readonly query: string;
  readonly filters: InboxFilters;
  readonly isStarred?: IsStarredRecord;
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
  isStarred = NEVER_STARRED,
}: FacetCountsParams): InboxFacetCounts => {
  const searched = records.filter((record) => matchesSearch({ record, query }));
  const forView = searched.filter((record) =>
    matchesFilters({ record, filters: { ...filters, view: 'all' }, isStarred }),
  );
  const forKind = searched.filter((record) =>
    matchesFilters({ record, filters: { ...filters, kind: 'all' }, isStarred }),
  );
  const forSource = searched.filter((record) =>
    matchesFilters({ record, filters: { ...filters, source: null }, isStarred }),
  );
  const forProject = searched.filter((record) =>
    matchesFilters({ record, filters: { ...filters, project: null }, isStarred }),
  );
  const viewCount = (view: InboxView): number =>
    forView.filter((record) => matchesView({ record, view, isStarred })).length;
  const kindCount = (filter: InboxTypeFacet): number =>
    forKind.filter((record) => matchesKindFilter({ kind: record.kind, filter })).length;
  return {
    view: {
      all: viewCount('all'),
      assigned: viewCount('assigned'),
      starred: viewCount('starred'),
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
    project: (project: ProjectId): number =>
      forProject.filter((record) => isTiedToProject({ record, project })).length,
    hasProjectMapping: forProject.some(
      (record) => record.projectIds != null && record.projectIds.length > 0,
    ),
  };
};

type ActiveCountParams = {
  readonly filters: InboxFilters;
};

export const activeFilterCount = ({ filters }: ActiveCountParams): number =>
  (filters.view === 'all' ? 0 : 1) +
  (filters.kind === 'all' ? 0 : 1) +
  (filters.source == null ? 0 : 1) +
  (filters.project == null ? 0 : 1);

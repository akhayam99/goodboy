import type { InboxKind, InboxProvider, InboxRecord } from './types';

export type InboxKindFilter = 'all' | 'issue' | 'pr-mr' | 'thread' | 'error';

export const INBOX_KIND_FILTERS: ReadonlyArray<InboxKindFilter> = [
  'all',
  'issue',
  'pr-mr',
  'thread',
  'error',
];

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
    record.meta.toLowerCase().includes(needle)
  );
};

type FilterRecordsParams = {
  readonly records: ReadonlyArray<InboxRecord>;
  readonly query: string;
  readonly kindFilter: InboxKindFilter;
  readonly providers: ReadonlySet<InboxProvider>;
};

export const filterInboxRecords = ({
  records,
  query,
  kindFilter,
  providers,
}: FilterRecordsParams): ReadonlyArray<InboxRecord> =>
  records.filter((record) => {
    if (!matchesKindFilter({ kind: record.kind, filter: kindFilter })) {
      return false;
    }
    if (providers.size > 0 && !providers.has(record.provider)) {
      return false;
    }
    return matchesSearch({ record, query });
  });

type KindFilterCountsParams = {
  readonly records: ReadonlyArray<InboxRecord>;
};

export const kindFilterCounts = ({
  records,
}: KindFilterCountsParams): Readonly<Record<InboxKindFilter, number>> => {
  const counts: Record<InboxKindFilter, number> = {
    all: records.length,
    issue: 0,
    'pr-mr': 0,
    thread: 0,
    error: 0,
  };
  for (const record of records) {
    for (const filter of INBOX_KIND_FILTERS) {
      if (filter !== 'all' && matchesKindFilter({ kind: record.kind, filter })) {
        counts[filter] += 1;
      }
    }
  }
  return counts;
};

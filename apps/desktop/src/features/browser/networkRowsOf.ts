import { matchesWords } from './matchesWords';
import { isFailedRequest } from './networkStatusWordOf';
import type { BrowserConsoleEntry, BrowserRequestType } from './types';

export type NetworkTypeFilter = 'all' | 'fetch' | 'doc' | 'js' | 'css' | 'img' | 'socket';

type Params = {
  readonly entries: ReadonlyArray<BrowserConsoleEntry>;
  readonly type: NetworkTypeFilter;
  readonly isFailedOnly: boolean;
  readonly query: string;
};

type TypeParams = {
  readonly entry: BrowserConsoleEntry;
  readonly type: NetworkTypeFilter;
};

const FILTER_OF_TYPE = {
  fetch: 'fetch',
  xhr: 'fetch',
  doc: 'doc',
  script: 'js',
  style: 'css',
  img: 'img',
  ws: 'socket',
  sse: 'socket',
  other: null,
} as const satisfies Record<BrowserRequestType, NetworkTypeFilter | null>;

const isTypeShown = ({ entry, type }: TypeParams): boolean => {
  if (type === 'all') {
    return true;
  }
  const kind = entry.network?.type ?? 'other';
  return FILTER_OF_TYPE[kind] === type;
};

export const networkRowsOf = ({
  entries,
  type,
  isFailedOnly,
  query,
}: Params): ReadonlyArray<BrowserConsoleEntry> => {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== '');
  return entries.filter(
    (entry) =>
      entry.kind === 'network' &&
      isTypeShown({ entry, type }) &&
      (!isFailedOnly || isFailedRequest({ status: entry.status })) &&
      matchesWords({
        words,
        fields: [entry.text, entry.method ?? '', String(entry.status ?? '')],
      }),
  );
};

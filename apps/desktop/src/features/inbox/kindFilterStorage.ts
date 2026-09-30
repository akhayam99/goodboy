import type { WorkspaceId } from '@goodboy/types';
import { STORAGE_PREFIXES, persistedPref } from '../../shared/lib/storage-keys';
import { INBOX_KIND_FILTERS, type InboxKindFilter } from './kindFilter';
import { INBOX_PROVIDERS, type InboxProvider } from './types';

type Params = {
  readonly workspaceId: WorkspaceId;
};

export type StoredInboxFilters = {
  readonly kind: InboxKindFilter;
  readonly source: InboxProvider | null;
};

type WriteParams = Params & StoredInboxFilters;

const storageKey = ({ workspaceId }: Params): string =>
  `${STORAGE_PREFIXES.inboxKindFilter}${workspaceId}`;

const isInboxKindFilter = (value: unknown): value is InboxKindFilter =>
  typeof value === 'string' && INBOX_KIND_FILTERS.some((candidate) => candidate === value);

const isInboxProvider = (value: unknown): value is InboxProvider =>
  typeof value === 'string' && INBOX_PROVIDERS.some((candidate) => candidate === value);

type SourceParams = {
  readonly source: unknown;
  readonly providers: unknown;
};

const storedSource = ({ source, providers }: SourceParams): InboxProvider | null | undefined => {
  if (source === null) {
    return null;
  }
  if (isInboxProvider(source)) {
    return source;
  }
  if (source !== undefined || !Array.isArray(providers)) {
    return undefined;
  }
  const legacy: ReadonlyArray<unknown> = providers;
  if (!legacy.every((provider) => isInboxProvider(provider))) {
    return undefined;
  }
  return INBOX_PROVIDERS.find((provider) => legacy.includes(provider)) ?? null;
};

const inboxFiltersPref = ({ workspaceId }: Params) =>
  persistedPref<StoredInboxFilters | null>({
    key: storageKey({ workspaceId }),
    fallback: null,
    parse: (raw) => {
      if (isInboxKindFilter(raw)) {
        return { kind: raw, source: null };
      }
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed == null || Array.isArray(parsed)) {
        return undefined;
      }
      const kind: unknown = Reflect.get(parsed, 'kindFilter');
      const source = storedSource({
        source: Reflect.get(parsed, 'source'),
        providers: Reflect.get(parsed, 'providers'),
      });
      if (!isInboxKindFilter(kind) || source === undefined) {
        return undefined;
      }
      return { kind, source };
    },
    serialize: (value) => JSON.stringify(value && { kindFilter: value.kind, source: value.source }),
  });

export const readInboxFilters = ({ workspaceId }: Params): StoredInboxFilters | null =>
  inboxFiltersPref({ workspaceId }).read();

export const writeInboxFilters = ({ workspaceId, kind, source }: WriteParams): void =>
  inboxFiltersPref({ workspaceId }).write({ kind, source });

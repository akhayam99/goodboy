import type { WorkspaceId } from '@goodboy/types';
import { STORAGE_PREFIXES } from '../../shared/lib/storage-keys';
import { INBOX_KIND_FILTERS, type InboxKindFilter } from './kindFilter';
import { INBOX_PROVIDERS, type InboxProvider } from './types';

type Params = {
  readonly workspaceId: WorkspaceId;
};

type WriteParams = Params & {
  readonly kindFilter: InboxKindFilter;
};

type WriteProvidersParams = Params & {
  readonly providers: ReadonlySet<InboxProvider>;
};

type StoredFilters = {
  readonly kindFilter: InboxKindFilter;
  readonly providers: ReadonlyArray<InboxProvider>;
};

const storageKey = ({ workspaceId }: Params): string =>
  `${STORAGE_PREFIXES.inboxKindFilter}${workspaceId}`;

const isInboxKindFilter = (value: unknown): value is InboxKindFilter =>
  typeof value === 'string' && INBOX_KIND_FILTERS.some((candidate) => candidate === value);

const isInboxProvider = (value: unknown): value is InboxProvider =>
  typeof value === 'string' && INBOX_PROVIDERS.some((candidate) => candidate === value);

const readStoredFilters = ({ workspaceId }: Params): StoredFilters | null => {
  try {
    const raw = localStorage.getItem(storageKey({ workspaceId }));
    if (isInboxKindFilter(raw)) {
      return { kindFilter: raw, providers: [] };
    }
    if (raw == null) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed == null || Array.isArray(parsed)) {
      return null;
    }
    const source = parsed as Readonly<Record<string, unknown>>;
    const kindFilter = source['kindFilter'];
    const providers = source['providers'];
    if (!isInboxKindFilter(kindFilter) || !Array.isArray(providers)) {
      return null;
    }
    const stored: ReadonlyArray<unknown> = providers;
    if (!stored.every((provider) => isInboxProvider(provider))) {
      return null;
    }
    return {
      kindFilter,
      providers: INBOX_PROVIDERS.filter((provider) => stored.includes(provider)),
    };
  } catch {
    return null;
  }
};

type PersistParams = Params & StoredFilters;

const persistFilters = ({ workspaceId, kindFilter, providers }: PersistParams): void => {
  try {
    localStorage.setItem(storageKey({ workspaceId }), JSON.stringify({ kindFilter, providers }));
  } catch {
    return;
  }
};

export const readInboxKindFilter = ({ workspaceId }: Params): InboxKindFilter | null => {
  return readStoredFilters({ workspaceId })?.kindFilter ?? null;
};

export const writeInboxKindFilter = ({ workspaceId, kindFilter }: WriteParams): void => {
  const stored = readStoredFilters({ workspaceId });
  persistFilters({ workspaceId, kindFilter, providers: stored?.providers ?? [] });
};

export const readInboxProviders = ({ workspaceId }: Params): ReadonlyArray<InboxProvider> => {
  return readStoredFilters({ workspaceId })?.providers ?? [];
};

export const writeInboxProviders = ({ workspaceId, providers }: WriteProvidersParams): void => {
  const stored = readStoredFilters({ workspaceId });
  persistFilters({
    workspaceId,
    kindFilter: stored?.kindFilter ?? 'all',
    providers: INBOX_PROVIDERS.filter((provider) => providers.has(provider)),
  });
};

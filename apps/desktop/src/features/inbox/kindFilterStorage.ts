import type { WorkspaceId } from '@goodboy/types';
import { STORAGE_PREFIXES } from '../../shared/lib/storage-keys';
import { INBOX_KIND_FILTERS, type InboxKindFilter } from './kindFilter';

type Params = {
  readonly workspaceId: WorkspaceId;
};

type WriteParams = Params & {
  readonly kindFilter: InboxKindFilter;
};

const storageKey = ({ workspaceId }: Params): string =>
  `${STORAGE_PREFIXES.inboxKindFilter}${workspaceId}`;

const isInboxKindFilter = (value: unknown): value is InboxKindFilter =>
  typeof value === 'string' && INBOX_KIND_FILTERS.some((candidate) => candidate === value);

export const readInboxKindFilter = ({ workspaceId }: Params): InboxKindFilter | null => {
  try {
    const raw = localStorage.getItem(storageKey({ workspaceId }));
    return isInboxKindFilter(raw) ? raw : null;
  } catch {
    return null;
  }
};

export const writeInboxKindFilter = ({ workspaceId, kindFilter }: WriteParams): void => {
  try {
    localStorage.setItem(storageKey({ workspaceId }), kindFilter);
  } catch {
    return;
  }
};

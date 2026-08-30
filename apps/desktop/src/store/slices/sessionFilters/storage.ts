import type { WorkspaceId } from '@goodboy/types';
import { STORAGE_PREFIXES } from '../../../shared/lib/storage-keys';

type PersistedFilters = {
  readonly v: 1;
  readonly selectedProjectIds: ReadonlyArray<string>;
};

type Params = {
  readonly workspaceId: WorkspaceId;
};

type WriteParams = Params & {
  readonly selectedProjectIds: ReadonlyArray<string>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const storageKey = ({ workspaceId }: Params): string =>
  `${STORAGE_PREFIXES.sessionFilters}${workspaceId}`;

export const readFromStorage = ({ workspaceId }: Params): ReadonlyArray<string> => {
  try {
    const raw = localStorage.getItem(storageKey({ workspaceId }));
    if (raw === null) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return [];
    }
    if (parsed['v'] !== 1 || !Array.isArray(parsed['selectedProjectIds'])) {
      return [];
    }
    return parsed['selectedProjectIds'].filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
};

export const writeToStorage = ({ workspaceId, selectedProjectIds }: WriteParams): void => {
  try {
    const persisted: PersistedFilters = { v: 1, selectedProjectIds };
    localStorage.setItem(storageKey({ workspaceId }), JSON.stringify(persisted));
  } catch {
    return;
  }
};

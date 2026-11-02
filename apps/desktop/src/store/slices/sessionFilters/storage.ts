import type { WorkspaceId } from '@goodboy/types';
import { isRecord } from '@goodboy/types/helpers';
import { STORAGE_PREFIXES, persistedPref } from '../../../shared/lib/storage-keys';
import { storageKeyOf } from '../../../shared/lib/storageKeyOf';

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

const NO_PROJECTS: ReadonlyArray<string> = [];

const filtersPref = ({ workspaceId }: Params) =>
  persistedPref<ReadonlyArray<string>>({
    key: storageKeyOf({ prefix: STORAGE_PREFIXES.sessionFilters, id: workspaceId }),
    fallback: NO_PROJECTS,
    parse: (raw) => {
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed)) {
        return undefined;
      }
      if (parsed['v'] !== 1 || !Array.isArray(parsed['selectedProjectIds'])) {
        return undefined;
      }
      return parsed['selectedProjectIds'].filter((id): id is string => typeof id === 'string');
    },
    serialize: (selectedProjectIds) => {
      const persisted: PersistedFilters = { v: 1, selectedProjectIds };
      return JSON.stringify(persisted);
    },
  });

export const readFromStorage = ({ workspaceId }: Params): ReadonlyArray<string> =>
  filtersPref({ workspaceId }).read();

export const writeToStorage = ({ workspaceId, selectedProjectIds }: WriteParams): void =>
  filtersPref({ workspaceId }).write(selectedProjectIds);

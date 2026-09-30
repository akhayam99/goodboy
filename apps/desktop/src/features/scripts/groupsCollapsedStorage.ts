import type { MountId, WorkspaceId } from '@goodboy/types';
import { STORAGE_PREFIXES, persistedPref } from '../../shared/lib/storage-keys';

type ReadParams = {
  readonly workspaceId: WorkspaceId;
};

type WriteParams = ReadParams & {
  readonly collapsed: ReadonlySet<MountId>;
};

const storageKey = ({ workspaceId }: ReadParams): string =>
  `${STORAGE_PREFIXES.scriptsGroupsCollapsed}${workspaceId}`;

const isStringArray = (value: unknown): value is ReadonlyArray<string> =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

const EMPTY_GROUPS: ReadonlySet<MountId> = new Set();

const groupsPref = ({ workspaceId }: ReadParams) =>
  persistedPref<ReadonlySet<MountId>>({
    key: storageKey({ workspaceId }),
    fallback: EMPTY_GROUPS,
    parse: (raw) => {
      const parsed: unknown = JSON.parse(raw);
      return isStringArray(parsed) ? new Set(parsed.map((entry) => entry as MountId)) : undefined;
    },
    serialize: (collapsed) => JSON.stringify([...collapsed]),
  });

export const readCollapsedGroups = ({ workspaceId }: ReadParams): ReadonlySet<MountId> =>
  groupsPref({ workspaceId }).read();

export const writeCollapsedGroups = ({ workspaceId, collapsed }: WriteParams): void =>
  groupsPref({ workspaceId }).write(collapsed);

import type { MountId, WorkspaceId } from '@goodboy/types';

type ReadParams = {
  readonly workspaceId: WorkspaceId;
};

type WriteParams = ReadParams & {
  readonly collapsed: ReadonlySet<MountId>;
};

const storageKey = ({ workspaceId }: ReadParams): string =>
  `goodboy:scripts-groups-collapsed:v1:${workspaceId}`;

const isStringArray = (value: unknown): value is ReadonlyArray<string> =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

export const readCollapsedGroups = ({ workspaceId }: ReadParams): ReadonlySet<MountId> => {
  try {
    const raw = localStorage.getItem(storageKey({ workspaceId }));
    if (raw === null) {
      return new Set();
    }
    const parsed: unknown = JSON.parse(raw);
    return isStringArray(parsed) ? new Set(parsed.map((entry) => entry as MountId)) : new Set();
  } catch {
    return new Set();
  }
};

export const writeCollapsedGroups = ({ workspaceId, collapsed }: WriteParams): void => {
  try {
    localStorage.setItem(storageKey({ workspaceId }), JSON.stringify([...collapsed]));
  } catch {
    return;
  }
};

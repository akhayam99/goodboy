import type { WorkspaceId } from '@goodboy/types';

type Params = {
  readonly workspaceId: WorkspaceId;
};

const versions = new Map<WorkspaceId, number>();

export const archivedCacheVersion = ({ workspaceId }: Params): number =>
  versions.get(workspaceId) ?? 0;

export const touchArchivedCache = ({ workspaceId }: Params): void => {
  versions.set(workspaceId, archivedCacheVersion({ workspaceId }) + 1);
};

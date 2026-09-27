import type { WorkspaceId } from '@goodboy/types';
import { linearFetchTeamKeys } from '../../linear/client';

const teamKeysCache = new Map<string, Promise<ReadonlyArray<string>>>();

export const teamKeysOf = (workspaceId: WorkspaceId): Promise<ReadonlyArray<string>> => {
  const cached = teamKeysCache.get(workspaceId);
  if (cached !== undefined) {
    return cached;
  }
  const pending = linearFetchTeamKeys({ workspaceId }).catch((): ReadonlyArray<string> => {
    if (teamKeysCache.get(workspaceId) === pending) {
      teamKeysCache.delete(workspaceId);
    }
    return [];
  });
  teamKeysCache.set(workspaceId, pending);
  return pending;
};

export const forgetTeamKeys = (workspaceId: WorkspaceId): void => {
  teamKeysCache.delete(workspaceId);
};

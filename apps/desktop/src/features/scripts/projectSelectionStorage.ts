import type { ProjectId, WorkspaceId } from '@goodboy/types';

type ReadParams = {
  readonly workspaceId: WorkspaceId;
};

type WriteParams = ReadParams & {
  readonly projectId: ProjectId;
};

const storageKey = ({ workspaceId }: ReadParams): string =>
  `goodboy:scripts:project:${workspaceId}`;

export const readScriptsProject = ({ workspaceId }: ReadParams): ProjectId | null => {
  try {
    return localStorage.getItem(storageKey({ workspaceId })) as ProjectId | null;
  } catch {
    return null;
  }
};

export const writeScriptsProject = ({ workspaceId, projectId }: WriteParams): void => {
  try {
    localStorage.setItem(storageKey({ workspaceId }), projectId);
  } catch {
    return;
  }
};

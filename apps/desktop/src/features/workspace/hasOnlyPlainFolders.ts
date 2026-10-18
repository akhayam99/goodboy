import type { Project, WorkspaceId } from '@goodboy/types';

type Params = {
  readonly projects: ReadonlyArray<Project>;
  readonly workspaceId: WorkspaceId;
};

export const hasOnlyPlainFolders = ({ projects, workspaceId }: Params): boolean => {
  const folders = projects.filter((project) => project.workspaceId === workspaceId);
  return folders.length > 0 && folders.every((project) => project.kind === 'folder');
};

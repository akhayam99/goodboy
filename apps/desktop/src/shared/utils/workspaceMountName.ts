import type { Project, ProjectId, Workspace } from '@goodboy/types';

type Params = {
  readonly workspace: Workspace | null;
  readonly projects: ReadonlyArray<Project>;
  readonly projectId?: ProjectId;
};

export const workspaceMountName = ({ workspace, projects, projectId }: Params): string | null => {
  if (workspace === null || projectId === undefined) {
    return null;
  }
  const workspaceProjects = projects.filter((project) => project.workspaceId === workspace.id);
  if (workspaceProjects.length < 2) {
    return null;
  }
  return workspaceProjects.find((project) => project.id === projectId)?.name ?? null;
};

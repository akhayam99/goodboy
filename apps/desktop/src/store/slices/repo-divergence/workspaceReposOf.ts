import type { Project, WorkspaceId } from '@goodboy/types';

type Params = {
  readonly projects: ReadonlyArray<Project>;
  readonly workspaceId: WorkspaceId;
};

export const workspaceReposOf = ({ projects, workspaceId }: Params): ReadonlyArray<Project> =>
  projects.filter(
    (project) =>
      project.workspaceId === workspaceId &&
      project.kind === 'repo' &&
      project.disconnectedAt == null,
  );

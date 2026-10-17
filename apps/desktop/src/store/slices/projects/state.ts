import type { Project, ProjectId, WorkspaceGitStatus } from '@goodboy/types';

export type ProjectsState = {
  readonly projects: ReadonlyArray<Project>;
  readonly projectGitStatus: Readonly<Record<ProjectId, WorkspaceGitStatus>>;
  readonly projectCheckoutPulling: Readonly<Record<ProjectId, boolean>>;
};

export const projectsInitialState: ProjectsState = {
  projects: [],
  projectGitStatus: {},
  projectCheckoutPulling: {},
};

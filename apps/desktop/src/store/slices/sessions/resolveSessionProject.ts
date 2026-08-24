import type { Project, ProjectId } from '@goodboy/types';

type Params = {
  readonly projects: ReadonlyArray<Project>;
  readonly projectId: ProjectId;
};

export const resolveSessionProject = ({ projects, projectId }: Params): Project => {
  const picked = projects.find((candidate) => candidate.id === projectId);
  if (picked === undefined) {
    throw new Error(`project not found in this workspace: ${projectId}`);
  }
  return picked;
};

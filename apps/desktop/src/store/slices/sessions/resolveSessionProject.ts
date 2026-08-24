import type { Project, ProjectId } from '@goodboy/types';

type Params = {
  readonly projects: ReadonlyArray<Project>;
  readonly projectId?: ProjectId;
};

export const resolveSessionProject = ({ projects, projectId }: Params): Project => {
  if (projects.length === 0) {
    throw new Error('this workspace has no project: add one before starting a session');
  }
  if (projectId !== undefined) {
    const picked = projects.find((candidate) => candidate.id === projectId);
    if (picked === undefined) {
      throw new Error(`project not found in this workspace: ${projectId}`);
    }
    return picked;
  }
  const only = projects[0];
  if (projects.length === 1 && only !== undefined) {
    return only;
  }
  throw new Error('this workspace has several projects: pick the one this session works in');
};

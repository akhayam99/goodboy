import type { ProjectId, PublishOutcome } from '@goodboy/types';
import { projectPublishMain } from '../../../shared/lib/repo';
import type { GetFn, SetFn } from './types';
import { projectById } from './projectIndex';

type Input = {
  readonly projectId: ProjectId;
};

export const publishProjectMain = (_set: SetFn, get: GetFn) => {
  return async ({ projectId }: Input): Promise<PublishOutcome> => {
    const project = projectById(get().projects, projectId);
    if (project === undefined) {
      throw new Error(`project not found: ${projectId}`);
    }
    if (project.kind !== 'repo') {
      throw new Error('only a repository project can be published');
    }
    const outcome = await projectPublishMain({
      projectPath: project.rootPath,
      workspaceId: project.workspaceId,
      projectId,
    });
    await get().loadProjectGitStatus({ projectId });
    return outcome;
  };
};

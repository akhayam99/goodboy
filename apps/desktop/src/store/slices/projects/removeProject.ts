import type { IsoDateTime, ProjectId } from '@goodboy/types';
import { disconnectProject } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { fileVersionsFolderStatus } from '../../../features/file-versions/fileVersions';
import type { GetFn, SetFn } from './types';
import { projectById } from './projectIndex';

type Input = {
  readonly projectId: ProjectId;
};

export const removeProject = (set: SetFn, get: GetFn) => {
  return async ({ projectId }: Input): Promise<void> => {
    const project = projectById(get().projects, projectId);
    if (project === undefined) {
      throw new Error(`project not found: ${projectId}`);
    }
    if (project.kind === 'folder') {
      const status = await fileVersionsFolderStatus({ folderPath: project.rootPath });
      if (status.isTurnOpen) {
        throw new Error(
          `An agent is still saving changes in ${project.name}. Unlink it when the turn has finished.`,
        );
      }
    }
    const at = new Date().toISOString() as IsoDateTime;
    await disconnectProject({ db: tauriDatabase, id: projectId, at });
    set((state) => {
      const projectGitStatus = { ...state.projectGitStatus };
      const projectCheckoutPulling = { ...state.projectCheckoutPulling };
      const repoDivergence = { ...state.repoDivergence };
      const repoPull = { ...state.repoPull };
      delete projectGitStatus[projectId];
      delete projectCheckoutPulling[projectId];
      delete repoDivergence[projectId];
      delete repoPull[projectId];
      return {
        projects: state.projects.filter((candidate) => candidate.id !== projectId),
        projectGitStatus,
        projectCheckoutPulling,
        repoDivergence,
        repoPull,
      };
    });
    if (project.kind === 'folder') {
      await get()
        .forgetFolderVersions({ folder: project })
        .catch((error: unknown) =>
          get().reportError({
            title: `Couldn't clear the first copy of ${project.name}`,
            error,
            severity: 'warning',
            workspaceId: project.workspaceId,
          }),
        );
    }
  };
};

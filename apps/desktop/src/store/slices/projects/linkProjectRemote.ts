import type { IsoDateTime, Project, ProjectId } from '@goodboy/types';
import { updateProjectIdentity } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { projectLinkRemote } from '../../../shared/lib/repo';
import type { GetFn, SetFn } from './types';
import { projectById } from './projectIndex';

type Input = {
  readonly projectId: ProjectId;
  readonly remoteUrl: string;
};

export const linkProjectRemote = (set: SetFn, get: GetFn) => {
  return async ({ projectId, remoteUrl }: Input): Promise<Project> => {
    const project = projectById(get().projects, projectId);
    if (project === undefined) {
      throw new Error(`project not found: ${projectId}`);
    }
    if (project.kind !== 'repo') {
      throw new Error('only a repository project can get a remote');
    }
    const trimmedRemote = remoteUrl.trim();
    if (trimmedRemote === '') {
      throw new Error('paste the address of the repository');
    }
    const linked = await projectLinkRemote({
      projectPath: project.rootPath,
      remoteUrl: trimmedRemote,
    });
    const checkedAt = new Date().toISOString() as IsoDateTime;
    await updateProjectIdentity({
      db: tauriDatabase,
      projectId,
      rootCommit: project.rootCommit ?? null,
      remoteUrl: linked.remoteUrl,
      checkedAt,
    });
    const updated: Project = {
      ...project,
      remoteUrl: linked.remoteUrl,
      identityCheckedAt: checkedAt,
      updatedAt: checkedAt,
    };
    set((state) => ({
      projects: state.projects.map((candidate) =>
        candidate.id === projectId ? updated : candidate,
      ),
    }));
    return updated;
  };
};

import type { IsoDateTime, Project, ProjectId } from '@goodboy/types';
import { updateProjectKind } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { initRepoWithRemote, validateGitRepo } from '../../../shared/lib/repo';
import type { GetFn, SetFn } from './types';

type Input = {
  readonly projectId: ProjectId;
  readonly remoteUrl: string;
};

export const convertProjectToRepo = (set: SetFn, get: GetFn) => {
  return async ({ projectId, remoteUrl }: Input): Promise<Project> => {
    const project = get().projects.find((candidate) => candidate.id === projectId);
    if (project === undefined) {
      throw new Error(`project not found: ${projectId}`);
    }
    if (project.kind !== 'folder') {
      throw new Error('only a folder project can become a repository');
    }
    const trimmedRemote = remoteUrl.trim();
    if (trimmedRemote === '') {
      throw new Error('pick a repository or paste its remote url');
    }
    const initialized = await initRepoWithRemote({
      path: project.rootPath,
      remoteUrl: trimmedRemote,
    });
    const check = await validateGitRepo(initialized.rootPath);
    if (check.isRepo === false) {
      throw new Error(check.error ?? 'the folder is still not a git repository');
    }
    const rootPath = check.rootPath ?? initialized.rootPath;
    await updateProjectKind({ db: tauriDatabase, id: projectId, kind: 'repo', rootPath });
    const converted: Project = {
      ...project,
      kind: 'repo',
      rootPath,
      updatedAt: new Date().toISOString() as IsoDateTime,
    };
    set((state) => ({
      projects: state.projects.map((candidate) =>
        candidate.id === projectId ? converted : candidate,
      ),
    }));
    return converted;
  };
};

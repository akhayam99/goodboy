import type { ProjectId, WorkspaceGitStatus } from '@goodboy/types';
import { updateProjectIdentity } from '@goodboy/db';
import type { IsoDateTime } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { projectGitStatus, repoIdentity } from '../../../shared/lib/repo';
import type { GetFn, SetFn } from './types';

type Input = {
  readonly projectId: ProjectId;
};

const UNREACHABLE: WorkspaceGitStatus = {
  state: 'missing',
  branch: null,
  headSubject: null,
  upstreamDistance: { kind: 'unknown', reason: 'rev-list-failed' },
  workingTree: { kind: 'unknown', reason: 'status-read-failed' },
  upstream: null,
  inProgress: null,
};

export const loadProjectGitStatus = (set: SetFn, get: GetFn) => {
  return async ({ projectId }: Input): Promise<void> => {
    const project = get().projects.find((candidate) => candidate.id === projectId);
    if (project === undefined || project.kind !== 'repo') {
      return;
    }
    const status = await projectGitStatus({ projectPath: project.rootPath }).catch(
      () => UNREACHABLE,
    );
    set((state) => ({ projectGitStatus: { ...state.projectGitStatus, [projectId]: status } }));
    if (status.state !== 'ready' || project.identityCheckedAt !== undefined) {
      return;
    }
    const identity = await repoIdentity({ path: project.rootPath }).catch(() => null);
    if (identity === null) {
      return;
    }
    const checkedAt = new Date().toISOString() as IsoDateTime;
    const rootCommit = identity.rootCommits[0] ?? null;
    await updateProjectIdentity({
      db: tauriDatabase,
      projectId,
      rootCommit,
      remoteUrl: identity.remoteUrl,
      checkedAt,
    });
    set((state) => ({
      projects: state.projects.map((entry) =>
        entry.id === projectId
          ? {
              ...entry,
              ...(rootCommit === null ? {} : { rootCommit }),
              ...(identity.remoteUrl === null ? {} : { remoteUrl: identity.remoteUrl }),
              identityCheckedAt: checkedAt,
              updatedAt: checkedAt,
            }
          : entry,
      ),
    }));
  };
};

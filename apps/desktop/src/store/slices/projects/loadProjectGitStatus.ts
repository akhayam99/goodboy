import type { ProjectId, WorkspaceGitStatus } from '@goodboy/types';
import { workspaceGitStatus } from '../../../shared/lib/repo';
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
    const status = await workspaceGitStatus({ workspacePath: project.rootPath }).catch(
      () => UNREACHABLE,
    );
    set((state) => ({ projectGitStatus: { ...state.projectGitStatus, [projectId]: status } }));
  };
};

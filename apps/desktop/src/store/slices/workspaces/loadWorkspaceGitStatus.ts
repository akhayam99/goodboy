import type { WorkspaceGitStatus, WorkspaceId } from '@goodboy/types';
import { workspaceGitStatus } from '../../../shared/lib/repo';
import type { GetFn, SetFn } from './types';

type Input = {
  workspaceId: WorkspaceId;
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

export const loadWorkspaceGitStatus = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId }: Input): Promise<void> => {
    const workspace = get().workspaces.find((candidate) => candidate.id === workspaceId);
    if (workspace == null || workspace.kind === 'simple' || workspace.kind === 'composite') {
      return;
    }
    const status = await workspaceGitStatus({ workspacePath: workspace.rootPath }).catch(
      () => UNREACHABLE,
    );
    set((state) => ({
      workspaceGitStatus: { ...state.workspaceGitStatus, [workspaceId]: status },
    }));
  };
};

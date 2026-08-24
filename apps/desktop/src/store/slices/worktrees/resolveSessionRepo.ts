import type { ProjectId, SessionId } from '@goodboy/types';
import type { AppState } from '../../types';

export type SessionRepo = Readonly<{
  repoRoot: string;
  worktreePath: string;
  branch: string;
  mountName: string | null;
  projectId: ProjectId;
}>;

type State = Pick<
  AppState,
  'sessions' | 'projects' | 'sessionProjectMounts' | 'sessionActiveProject'
>;

type ResolveParams = {
  readonly state: State;
  readonly sessionId: SessionId;
};

export const resolveSessionRepo = ({ state, sessionId }: ResolveParams): SessionRepo | null => {
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  if (session === undefined) {
    return null;
  }
  const mounts = state.sessionProjectMounts[sessionId] ?? [];
  const activeProjectId = state.sessionActiveProject[sessionId] ?? session.activeProjectId;
  const activeMount = mounts.find((mount) => mount.projectId === activeProjectId) ?? mounts[0];
  if (activeMount === undefined) {
    return null;
  }
  const project = state.projects.find((candidate) => candidate.id === activeMount.projectId);
  if (project === undefined || project.kind !== 'repo') {
    return null;
  }
  return {
    repoRoot: activeMount.repoRoot,
    worktreePath: activeMount.worktreePath,
    branch: activeMount.branch,
    mountName: activeMount.mountName,
    projectId: activeMount.projectId,
  };
};

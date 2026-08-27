import type { ProjectId, SessionId } from '@goodboy/types';
import type { AppState } from '../../types';

type State = Pick<AppState, 'sessions' | 'sessionProjectMounts'>;

type Params = {
  readonly state: State;
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
};

export const resolveProjectMountPath = ({ state, sessionId, projectId }: Params): string | null => {
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  if (session === undefined) {
    return null;
  }
  const mounts = state.sessionProjectMounts[sessionId] ?? [];
  const mount = mounts.find((candidate) => candidate.projectId === projectId);
  return mount?.worktreePath ?? null;
};

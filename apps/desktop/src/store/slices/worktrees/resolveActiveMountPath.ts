import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../types';

type State = Pick<AppState, 'sessions' | 'sessionProjectMounts' | 'sessionActiveProject'>;

type Params = {
  readonly state: State;
  readonly sessionId: SessionId;
};

export const resolveActiveMountPath = ({ state, sessionId }: Params): string | null => {
  const mounts = state.sessionProjectMounts[sessionId] ?? [];
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  const activeProjectId = state.sessionActiveProject[sessionId] ?? session?.activeProjectId;
  const activeMount = mounts.find((mount) => mount.projectId === activeProjectId) ?? mounts[0];
  return activeMount?.worktreePath ?? null;
};

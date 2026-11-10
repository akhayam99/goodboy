import type { Session } from '@goodboy/types';
import type { AppState } from '../../store/types';

type Params = {
  readonly state: Pick<AppState, 'sessions' | 'currentWorkspaceId'>;
};

export const browserScopeSessions = ({ state }: Params): ReadonlyArray<Session> =>
  state.sessions.filter((session) => session.workspaceId === state.currentWorkspaceId);

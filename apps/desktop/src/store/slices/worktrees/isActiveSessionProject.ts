import type { ProjectId, SessionId } from '@goodboy/types';
import { resolveSessionRepo } from './resolveSessionRepo';
import type { AppState } from '../../types';

type State = Pick<
  AppState,
  'sessions' | 'projects' | 'sessionProjectMounts' | 'sessionActiveProject'
>;

type Params = {
  readonly state: State;
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
};

export const isActiveSessionProject = ({ state, sessionId, projectId }: Params): boolean =>
  resolveSessionRepo({ state, sessionId })?.projectId === projectId;

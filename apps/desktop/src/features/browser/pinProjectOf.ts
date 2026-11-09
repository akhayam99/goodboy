import type { ProjectId, SessionId } from '@goodboy/types';
import type { AppState } from '../../store/types';

type Params = {
  readonly state: Pick<AppState, 'sessionProjectMounts' | 'sessionActiveMount'>;
  readonly sessionId: SessionId;
};

export const pinProjectOf = ({ state, sessionId }: Params): ProjectId | null => {
  const mounts = state.sessionProjectMounts[sessionId] ?? [];
  const activeId = state.sessionActiveMount[sessionId];
  const mount = mounts.find((candidate) => candidate.mountId === activeId) ?? mounts[0];
  return mount?.projectId ?? null;
};

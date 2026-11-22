import type { ProjectId, SessionId } from '@goodboy/types';
import type { AppState } from '../../../../store/types';

type Params = {
  readonly state: Pick<AppState, 'sessionMounts' | 'sessionProjectMounts'>;
  readonly sessionId: SessionId;
};

export const sessionProjectIdsOf = ({ state, sessionId }: Params): ReadonlyArray<ProjectId> => {
  const views = state.sessionMounts?.[sessionId] ?? null;
  const mounts = views ?? state.sessionProjectMounts[sessionId] ?? [];
  return [...new Set(mounts.map((mount) => mount.projectId))];
};

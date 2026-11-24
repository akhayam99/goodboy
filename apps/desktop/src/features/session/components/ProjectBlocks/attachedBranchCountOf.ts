import type { ProjectId, SessionId } from '@goodboy/types';
import type { AppState } from '../../../../store/types';

type Params = {
  readonly state: Pick<AppState, 'sessionProjectMounts'>;
  readonly sessionId: SessionId;
  readonly projectId: ProjectId | null;
};

export const attachedBranchCountOf = ({ state, sessionId, projectId }: Params): number =>
  projectId === null
    ? 0
    : (state.sessionProjectMounts[sessionId] ?? []).filter((mount) => mount.projectId === projectId)
        .length;

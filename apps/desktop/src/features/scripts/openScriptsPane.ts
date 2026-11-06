import type { ProjectId, SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';

type Params = {
  readonly state: Pick<AppStore, 'openDrawer'>;
  readonly sessionId: SessionId;
  readonly projectId: ProjectId | null;
};

export const openScriptsPane = ({ state, sessionId, projectId }: Params): void => {
  state.openDrawer({
    kind: 'scripts',
    sessionId,
    payload: projectId === null ? null : { projectId },
  });
};

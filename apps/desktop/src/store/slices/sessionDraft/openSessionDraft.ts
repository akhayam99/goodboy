import { firstLapProjectOfWorkspace } from '../bootstrap/firstLap';
import { SESSION_DRAFT_PLACE, sessionPlace } from '../navigation/place';
import type { GetFn } from './types';

export const openSessionDraft = (get: GetFn) => {
  return (): void => {
    const state = get();
    if (state.currentWorkspaceId === null) {
      return;
    }
    const firstLapProject = firstLapProjectOfWorkspace({
      state,
      workspaceId: state.currentWorkspaceId,
    });
    if (firstLapProject === null) {
      state.navigate({ to: SESSION_DRAFT_PLACE });
      return;
    }
    void state
      .ensureFirstLapSession({ projectId: firstLapProject.id })
      .then((session) => get().navigate({ to: sessionPlace({ sessionId: session.id }) }))
      .catch(() => get().navigate({ to: SESSION_DRAFT_PLACE }));
  };
};

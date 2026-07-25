import type { RoleModelPreferences, SessionId } from '@goodboy/types';
import type { AppStore } from '../../store';

type Params = {
  readonly state: AppStore;
  readonly sessionId: SessionId | null;
};

export const roleModelsForSession = ({ state, sessionId }: Params): RoleModelPreferences | null => {
  if (sessionId == null) {
    return null;
  }
  const session = state.sessions?.find((entry) => entry.id === sessionId);
  if (session == null) {
    return null;
  }
  return state.workspaceOverrides?.[session.workspaceId]?.roleModels ?? null;
};

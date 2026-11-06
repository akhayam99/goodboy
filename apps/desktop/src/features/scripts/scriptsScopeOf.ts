import type { ProjectId, SessionId } from '@goodboy/types';
import type { AppState } from '../../store/types';
import { selectOpenDrawer } from '../../store/slices/drawer/selectOpenDrawer';

type Params = {
  readonly state: Pick<AppState, 'drawer' | 'currentSessionId'>;
  readonly sessionId: SessionId;
};

export const scriptsScopeOf = ({ state, sessionId }: Params): ProjectId | null => {
  const drawer = selectOpenDrawer(state);
  return drawer?.kind === 'scripts' && drawer.sessionId === sessionId
    ? (drawer.payload?.projectId ?? null)
    : null;
};

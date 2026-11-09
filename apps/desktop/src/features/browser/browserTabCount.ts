import type { AppState } from '../../store/types';
import { browserPinProjectIds } from './browserPinProjectIds';
import { browserScopeSessions } from './browserScopeSessions';
import { pinProjectOf } from './pinProjectOf';

type Params = {
  readonly state: Pick<
    AppState,
    | 'sessions'
    | 'currentWorkspaceId'
    | 'browserSessionTabs'
    | 'browserProjectPins'
    | 'sessionProjectMounts'
    | 'sessionActiveMount'
  >;
};

export const browserTabCount = ({ state }: Params): number => {
  const sessions = browserScopeSessions({ state });
  const projectIds = browserPinProjectIds({
    projectOf: sessions.map((session) => pinProjectOf({ state, sessionId: session.id })),
  });
  const tabs = sessions.reduce(
    (total, session) => total + (state.browserSessionTabs[session.id]?.length ?? 0),
    0,
  );
  return projectIds.reduce(
    (total, projectId) => total + (state.browserProjectPins[projectId]?.length ?? 0),
    tabs,
  );
};

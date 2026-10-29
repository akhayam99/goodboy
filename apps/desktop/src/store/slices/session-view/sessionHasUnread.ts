import type { SessionId } from '@goodboy/types';
import { viewedAgentIdOf, type ViewedState } from '../../../shared/utils/viewedAgentIdOf';
import type { AppState } from '../../types';
import { unreadAgentsOf } from '../agents/unreadAgentsOf';

type SessionUnreadState = Pick<AppState, 'sessionPhaseRuns'> & ViewedState;

type Params = {
  readonly state: SessionUnreadState;
  readonly sessionId: SessionId;
};

export const sessionHasUnread = ({ state, sessionId }: Params): boolean => {
  return (
    unreadAgentsOf({
      agents: state.sessionPhaseRuns[sessionId],
      viewedAgentId: viewedAgentIdOf({ state, sessionId }),
    }).length > 0
  );
};

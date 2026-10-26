import type { SessionId } from '@goodboy/types';
import { viewedAgentIdOf, type ViewedState } from '../../../shared/utils/viewedAgentIdOf';
import type { AppState } from '../../types';
import { agentHasUnread } from '../agents/agentHasUnread';

type SessionUnreadState = Pick<AppState, 'sessionPhaseRuns'> & ViewedState;

type Params = {
  readonly state: SessionUnreadState;
  readonly sessionId: SessionId;
};

export const sessionHasUnread = ({ state, sessionId }: Params): boolean => {
  const runs = state.sessionPhaseRuns[sessionId];
  if (runs === undefined) {
    return false;
  }
  const viewed = viewedAgentIdOf({ state, sessionId });
  return runs.some((run) => agentHasUnread(run, run.id === viewed));
};

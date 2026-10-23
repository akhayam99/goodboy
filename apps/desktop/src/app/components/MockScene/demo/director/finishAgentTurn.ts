import type { AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import { applyAgentTurnState } from '../../../../../store/slices/sessions/sessionMutators';
import type { DirectorStore } from './directorTypes';
import { patchAgent } from './patchAgent';

type Params = {
  readonly store: DirectorStore;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly at: IsoDateTime;
  readonly isViewed: boolean;
};

export const finishAgentTurn = ({ store, sessionId, agentId, at, isViewed }: Params): void => {
  patchAgent({
    store,
    sessionId,
    agentId,
    patch: {
      status: 'completed',
      completedAt: at,
      lastFinishedAt: at,
      ...(isViewed ? { lastViewedAt: at } : {}),
    },
  });
  applyAgentTurnState(store.setState, sessionId, agentId, { kind: 'idle', lastActivityAt: at }, at);
};

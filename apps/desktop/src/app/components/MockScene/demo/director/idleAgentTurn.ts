import type { AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import { applyAgentTurnState } from '../../../../../store/slices/sessions/sessionMutators';
import type { DirectorStore } from './directorTypes';

type Params = {
  readonly store: DirectorStore;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly at: IsoDateTime;
};

export const idleAgentTurn = ({ store, sessionId, agentId, at }: Params): void => {
  applyAgentTurnState(store.setState, sessionId, agentId, { kind: 'idle', lastActivityAt: at }, at);
};

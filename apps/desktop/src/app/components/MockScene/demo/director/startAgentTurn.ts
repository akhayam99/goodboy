import type { AgentId, IsoDateTime, ProviderRunId, SessionId } from '@goodboy/types';
import { applyAgentTurnState } from '../../../../../store/slices/sessions/sessionMutators';
import type { DirectorStore } from './directorTypes';
import { patchAgent } from './patchAgent';

type Params = {
  readonly store: DirectorStore;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly runId: ProviderRunId;
  readonly at: IsoDateTime;
};

export const startAgentTurn = ({ store, sessionId, agentId, runId, at }: Params): void => {
  patchAgent({ store, sessionId, agentId, patch: { status: 'running', startedAt: at } });
  applyAgentTurnState(
    store.setState,
    sessionId,
    agentId,
    { kind: 'running', runId, startedAt: at },
    at,
  );
};

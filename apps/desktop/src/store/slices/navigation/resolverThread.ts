import type { AgentId, SessionId } from '@goodboy/types';
import type { AppState } from '../../types';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export const resolverThread = ({ state, sessionId, agentId }: Params): string | null =>
  (state.sessionResolveAttempts?.[sessionId] ?? []).find((attempt) => attempt.agentId === agentId)
    ?.threadIds[0] ?? null;

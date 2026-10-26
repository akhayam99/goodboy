import type { AgentId, SessionId } from '@goodboy/types';

export type ViewedState = {
  readonly currentSessionId: SessionId | null;
  readonly selectedAgentId: Readonly<Record<SessionId, AgentId | null>>;
};

type Params = {
  readonly state: ViewedState;
  readonly sessionId: SessionId;
};

export const viewedAgentIdOf = ({ state, sessionId }: Params): AgentId | null => {
  if (state.currentSessionId !== sessionId) {
    return null;
  }
  return state.selectedAgentId[sessionId] ?? null;
};

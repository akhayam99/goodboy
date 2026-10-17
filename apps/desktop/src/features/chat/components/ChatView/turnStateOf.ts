import type { AgentId, Session, TurnState } from '@goodboy/types';

type Params = {
  readonly agentState: TurnState | null;
  readonly selectedAgentId: AgentId | null;
  readonly session: Session;
};

export const turnStateOf = ({ agentState, selectedAgentId, session }: Params): TurnState => {
  if (agentState !== null) {
    return agentState;
  }
  if (selectedAgentId === null || session.state.kind === 'ended') {
    return session.state;
  }
  return { kind: 'idle', lastActivityAt: session.updatedAt };
};

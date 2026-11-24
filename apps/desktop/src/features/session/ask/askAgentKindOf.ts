import type { AgentId, SessionId } from '@goodboy/types';
import type { AppState } from '../../../store/types';
import { classifyAgent, type AgentKind } from '../agent-kind';

type Params = {
  readonly state: Pick<AppState, 'sessionPhaseRuns' | 'agentKindOverride'>;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export const askAgentKindOf = ({ state, sessionId, agentId }: Params): AgentKind | null => {
  const agent = (state.sessionPhaseRuns[sessionId] ?? []).find(
    (candidate) => candidate.id === agentId,
  );
  if (agent === undefined) {
    return null;
  }
  return classifyAgent({ agent, override: state.agentKindOverride[agent.id] ?? null });
};

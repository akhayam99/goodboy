import type { Agent, SessionId } from '@goodboy/types';
import { viewedAgentIdOf, type ViewedState } from '../../../shared/utils/viewedAgentIdOf';
import type { AppState } from '../../types';

type UnreadTargetState = Pick<AppState, 'sessionPhaseRuns'> & ViewedState;

type Params = {
  readonly state: UnreadTargetState;
  readonly sessionId: SessionId;
};

type AgentParams = {
  readonly agent: Agent;
};

const isMarkable = ({ agent }: AgentParams): boolean =>
  agent.lastFinishedAt != null && agent.doneAt == null && agent.status !== 'skipped';

export const unreadTargetOf = ({ state, sessionId }: Params): Agent | null => {
  const inView = viewedAgentIdOf({ state, sessionId });
  const candidates = (state.sessionPhaseRuns[sessionId] ?? []).filter(
    (agent) => agent.id !== inView && isMarkable({ agent }),
  );
  return candidates.reduce<Agent | null>((latest, agent) => {
    if (latest === null) {
      return agent;
    }
    return (agent.lastFinishedAt ?? '') > (latest.lastFinishedAt ?? '') ? agent : latest;
  }, null);
};

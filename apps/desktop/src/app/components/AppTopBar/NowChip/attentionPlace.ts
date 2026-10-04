import type { Agent, SessionAttentionReason, SessionId, TurnState } from '@goodboy/types';
import { agentPlace, branchPlace, sessionPlace } from '../../../../store';
import type { PlaceRequest } from '../../../../store/slices/navigation/types';
import { agentHasUnread } from '../../../../store/slices/agents/agentHasUnread';

type State = {
  readonly sessionPhaseRuns: Readonly<Record<string, ReadonlyArray<Agent>>>;
  readonly agentTurnState: Readonly<Record<string, TurnState>>;
};

type Params = {
  readonly state: State;
  readonly sessionId: SessionId;
  readonly reason: SessionAttentionReason | null;
};

const latestAgent = ({ agents }: { readonly agents: ReadonlyArray<Agent> }): Agent | null =>
  agents.reduce<Agent | null>(
    (latest, agent) => (latest === null || agent.ordinal > latest.ordinal ? agent : latest),
    null,
  );

export const attentionPlace = ({ state, sessionId, reason }: Params): PlaceRequest => {
  if (reason === 'open-question') {
    return sessionPlace({ sessionId, lens: 'questions' });
  }
  if (reason === 'ci-failed') {
    return branchPlace({ sessionId, tab: 'checks' });
  }
  if (reason === 'pr-approved' || reason === 'changes-requested') {
    return branchPlace({ sessionId, tab: 'comments' });
  }
  if (reason === null) {
    return sessionPlace({ sessionId });
  }

  const agents = state.sessionPhaseRuns[sessionId] ?? [];
  const target =
    reason === 'needs-approval'
      ? latestAgent({
          agents: agents.filter((agent) => state.agentTurnState[agent.id]?.kind === 'blocked'),
        })
      : reason === 'agent-error'
        ? latestAgent({ agents: agents.filter((agent) => agent.status === 'failed') })
        : reason === 'unread-reply'
          ? latestAgent({ agents: agents.filter((agent) => agentHasUnread(agent, false)) })
          : null;

  if (target === null) {
    return sessionPlace({ sessionId });
  }
  return agentPlace({ sessionId, agentId: target.id });
};

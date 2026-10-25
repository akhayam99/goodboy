import type { Agent, AgentId, IsoDateTime } from '@goodboy/types';
import { agentHasUnread } from './agentHasUnread';

type Boundaries = Readonly<Record<AgentId, IsoDateTime>>;

type Params = {
  readonly boundaries: Boundaries;
  readonly agent: Agent | undefined;
  readonly leftAgentId: AgentId | null;
  readonly agentId: AgentId;
};

type WithoutParams = {
  readonly boundaries: Boundaries;
  readonly agentId: AgentId;
};

const boundariesWithout = ({ boundaries, agentId }: WithoutParams): Boundaries => {
  if (boundaries[agentId] === undefined) {
    return boundaries;
  }
  return Object.fromEntries(Object.entries(boundaries).filter(([key]) => key !== agentId));
};

export const unseenBoundariesOf = ({
  boundaries,
  agent,
  leftAgentId,
  agentId,
}: Params): Boundaries => {
  const afterLeaving =
    leftAgentId !== null && leftAgentId !== agentId
      ? boundariesWithout({ boundaries, agentId: leftAgentId })
      : boundaries;
  if (leftAgentId === agentId) {
    return afterLeaving;
  }
  if (agent !== undefined && agentHasUnread(agent, false) && agent.lastViewedAt != null) {
    return { ...afterLeaving, [agentId]: agent.lastViewedAt };
  }
  return boundariesWithout({ boundaries: afterLeaving, agentId });
};

import type { AgentId } from '@goodboy/types';

type Params = Readonly<{
  agentId: AgentId;
}>;

const stopping = new Set<AgentId>();

export const markAgentStopping = ({ agentId }: Params): void => {
  stopping.add(agentId);
};

export const clearAgentStopping = ({ agentId }: Params): void => {
  stopping.delete(agentId);
};

export const isAgentStopping = ({ agentId }: Params): boolean => stopping.has(agentId);

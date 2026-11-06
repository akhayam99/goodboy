import type { AgentId } from '@goodboy/types';

type Params = Readonly<{
  agentId: AgentId;
}>;

const stopping = new Map<AgentId, number>();

export const markAgentStopping = ({ agentId }: Params): void => {
  stopping.set(agentId, (stopping.get(agentId) ?? 0) + 1);
};

export const clearAgentStopping = ({ agentId }: Params): void => {
  const count = stopping.get(agentId) ?? 0;
  if (count <= 1) {
    stopping.delete(agentId);
    return;
  }
  stopping.set(agentId, count - 1);
};

export const isAgentStopping = ({ agentId }: Params): boolean => stopping.has(agentId);

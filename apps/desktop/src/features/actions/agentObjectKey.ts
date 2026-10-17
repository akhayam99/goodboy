import type { AgentId } from '@goodboy/types';

type Params = {
  readonly agentId: AgentId;
};

export const agentObjectKey = ({ agentId }: Params): string => `agent:${agentId}`;

type Params = {
  readonly agentId: string;
};

export const agentLiveKey = ({ agentId }: Params): string => `agent:${agentId}`;

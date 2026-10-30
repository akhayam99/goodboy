type Params = {
  readonly agentIds: ReadonlyArray<string>;
};

export const runAgentCountOf = ({ agentIds }: Params): number => new Set(agentIds).size;

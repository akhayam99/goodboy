const sequences = new Map<string, number>();

type AgentParams = {
  readonly agentId: string;
};

export const sendSequenceOf = ({ agentId }: AgentParams): string =>
  String(sequences.get(agentId) ?? 0);

export const bumpSendSequence = ({ agentId }: AgentParams): void => {
  sequences.set(agentId, (sequences.get(agentId) ?? 0) + 1);
};

export const clearSendSequences = (): void => {
  sequences.clear();
};

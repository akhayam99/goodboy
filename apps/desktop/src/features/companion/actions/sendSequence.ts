const sequences = new Map<string, number>();

let generation = '';

type GenerationParams = {
  readonly value: string;
};

export const setSendGeneration = ({ value }: GenerationParams): void => {
  generation = value;
};

type AgentParams = {
  readonly agentId: string;
};

export const sendSequenceOf = ({ agentId }: AgentParams): string => {
  const count = sequences.get(agentId) ?? 0;
  return generation === '' ? String(count) : `${generation}.${count}`;
};

export const bumpSendSequence = ({ agentId }: AgentParams): void => {
  sequences.set(agentId, (sequences.get(agentId) ?? 0) + 1);
};

export const clearSendSequences = (): void => {
  sequences.clear();
};

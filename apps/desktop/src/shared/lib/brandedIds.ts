import type { AgentId } from '@goodboy/types';

type ValueParams = {
  readonly value: string;
};

const isNonEmpty = (value: string): boolean => value.length > 0;

const isAgentId = (value: string): value is AgentId => isNonEmpty(value);

export const agentIdOf = ({ value }: ValueParams): AgentId => {
  if (!isAgentId(value)) {
    throw new Error('An agent id cannot be empty');
  }
  return value;
};

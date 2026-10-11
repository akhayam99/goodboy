import type { AgentId } from '@goodboy/types';

type ValueParams = {
  readonly value: string;
};

type AgentIdParams = {
  readonly value: AgentId;
};

const isNonEmpty = ({ value }: ValueParams): boolean => value.length > 0;

const isAgentIdParams = (params: ValueParams): params is AgentIdParams => isNonEmpty(params);

export const agentIdOf = (params: ValueParams): AgentId => {
  if (!isAgentIdParams(params)) {
    throw new Error('An agent id cannot be empty');
  }
  return params.value;
};

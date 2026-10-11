import type { AgentId, IsoDateTime, SessionId } from '@goodboy/types';

type ValueParams = {
  readonly value: string;
};

const isNonEmpty = (value: string): boolean => value.length > 0;

const isAgentId = (value: string): value is AgentId => isNonEmpty(value);
const isSessionId = (value: string): value is SessionId => isNonEmpty(value);
const isIsoDateTime = (value: string): value is IsoDateTime => !Number.isNaN(Date.parse(value));

export const agentIdOf = ({ value }: ValueParams): AgentId => {
  if (!isAgentId(value)) {
    throw new Error('An agent id cannot be empty');
  }
  return value;
};

export const sessionIdOf = ({ value }: ValueParams): SessionId => {
  if (!isSessionId(value)) {
    throw new Error('A session id cannot be empty');
  }
  return value;
};

export const isoDateTimeOf = ({ value }: ValueParams): IsoDateTime => {
  if (!isIsoDateTime(value)) {
    throw new Error('Not an ISO date time');
  }
  return value;
};

import { brandId, type AgentId, type SessionId } from '@goodboy/types';

type ValueParams = {
  readonly value: string;
};

export const sessionIdOf = ({ value }: ValueParams): SessionId => brandId<SessionId>({ value });

export const agentIdOf = ({ value }: ValueParams): AgentId => brandId<AgentId>({ value });

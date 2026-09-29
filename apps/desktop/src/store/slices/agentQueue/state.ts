import type { AgentId } from '@goodboy/types';
import type { AgentQueuedTurn } from './types';

export type AgentQueueState = {
  readonly agentQueue: Readonly<Record<AgentId, ReadonlyArray<AgentQueuedTurn>>>;
};

export const agentQueueInitialState: AgentQueueState = {
  agentQueue: {},
};

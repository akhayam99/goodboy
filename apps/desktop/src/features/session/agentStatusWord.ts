import type { AgentStatus } from '@goodboy/types';
import { describeAgentStatus } from './agent-status';

type Params = {
  readonly status: AgentStatus;
};

export const agentStatusWord = ({ status }: Params): string =>
  describeAgentStatus({ status }).label.toLowerCase();

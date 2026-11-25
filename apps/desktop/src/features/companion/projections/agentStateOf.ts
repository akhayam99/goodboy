import type { AgentStatus } from '@goodboy/types';
import type { AgentState } from '../contract/projections';

type Params = {
  readonly status: AgentStatus;
};

export const agentStateOf = ({ status }: Params): AgentState => {
  if (status === 'running') {
    return 'running';
  }
  if (status === 'blocked') {
    return 'waiting';
  }
  if (status === 'failed') {
    return 'failed';
  }
  if (status === 'stopped') {
    return 'stopped';
  }
  return 'done';
};

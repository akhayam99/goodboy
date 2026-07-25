import type { Agent } from '@goodboy/types';
import type { ResolverStatus } from '../../resolver-linkage';

type Params = {
  readonly agent: Agent;
  readonly status: ResolverStatus;
};

export const canForceCloseResolver = ({ agent, status }: Params): boolean => {
  if (status === 'running') {
    return true;
  }
  return agent.status === 'running';
};

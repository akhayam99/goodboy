import type { Agent } from '@goodboy/types';
import type { ResolverStatus } from './resolver-linkage';

const SETTLED_RESOLVER_STATUSES: ReadonlyArray<ResolverStatus> = ['resolved', 'stopped'];

type Params = {
  readonly agent: Agent;
  readonly resolverStatus?: ResolverStatus | null;
};

export const isAgentFinished = ({ agent, resolverStatus = null }: Params): boolean => {
  if (agent.doneAt != null) {
    return true;
  }
  if (resolverStatus == null) {
    return false;
  }
  return SETTLED_RESOLVER_STATUSES.includes(resolverStatus);
};

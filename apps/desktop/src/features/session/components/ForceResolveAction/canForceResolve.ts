import type { Agent, TurnState } from '@goodboy/types';
import type { ResolverStatus } from '../../resolver-linkage';
import { agentThreadIds } from '../../agentThreadIds';

type Params = {
  readonly agent: Agent;
  readonly status: ResolverStatus;
  readonly turnState: TurnState | undefined;
};

export const canForceResolve = ({ agent, status, turnState }: Params): boolean => {
  if (agentThreadIds(agent).length === 0) {
    return false;
  }
  if (turnState?.kind === 'running' || turnState?.kind === 'starting') {
    return false;
  }
  return status === 'awaiting' || status === 'failed' || status === 'done' || status === 'stopped';
};

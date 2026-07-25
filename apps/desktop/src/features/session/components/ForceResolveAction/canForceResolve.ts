import type { Agent, TurnState } from '@goodboy/types';
import type { ResolverStatus } from '../../resolver-linkage';

type Params = {
  readonly agent: Agent;
  readonly status: ResolverStatus;
  readonly turnState: TurnState | undefined;
};

export const canForceResolve = ({ agent, status, turnState }: Params): boolean => {
  if (agent.sourceThreadId == null) {
    return false;
  }
  if (turnState?.kind === 'running' || turnState?.kind === 'starting') {
    return false;
  }
  return status === 'awaiting' || status === 'failed' || status === 'done' || status === 'stopped';
};

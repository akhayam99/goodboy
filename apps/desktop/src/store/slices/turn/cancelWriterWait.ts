import type { AgentId } from '@goodboy/types';
import { cancelTurnStartWindow } from './turnStartWindow';
import type { GetFn } from './types';
import { writerWaiters } from './writerWaiters';

type Deps = Readonly<{ get: GetFn }>;

type Params = Readonly<{ agentId: AgentId }>;

export const cancelWriterWait = ({ get }: Deps) => {
  return ({ agentId }: Params): boolean => {
    if (get().agentWriterWait[agentId] === undefined) {
      return false;
    }
    const isCancelled = cancelTurnStartWindow({ agentId });
    writerWaiters.wake();
    return isCancelled;
  };
};

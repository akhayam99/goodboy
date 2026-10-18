import type { AgentId } from '@goodboy/types';
import { readOnlyAnswers } from './readOnlyAnswers';
import type { GetFn } from './types';
import { writerWaiters } from './writerWaiters';

type Deps = Readonly<{ get: GetFn }>;

type Params = Readonly<{ agentId: AgentId }>;

export const answerWithoutEditing = ({ get }: Deps) => {
  return ({ agentId }: Params): boolean => {
    if (get().agentWriterWait[agentId] === undefined) {
      return false;
    }
    readOnlyAnswers.request({ agentId });
    writerWaiters.wake();
    return true;
  };
};

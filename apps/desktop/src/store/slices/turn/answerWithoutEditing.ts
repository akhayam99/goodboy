import type { AgentId } from '@goodboy/types';
import { readOnlyAnswers } from './readOnlyAnswers';
import type { GetFn } from './types';
import { writerWaiters } from './writerWaiters';

type Deps = Readonly<{ get: GetFn }>;

type Params = Readonly<{ agentId: AgentId }>;

export const answerWithoutEditing = ({ get }: Deps) => {
  return ({ agentId }: Params): boolean => {
    const wait = get().agentWriterWait[agentId];
    if (wait === undefined || wait.canAnswerReadOnly === false) {
      return false;
    }
    readOnlyAnswers.request({ agentId });
    writerWaiters.wake();
    return true;
  };
};

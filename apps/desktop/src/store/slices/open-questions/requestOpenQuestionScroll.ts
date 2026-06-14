import type { AgentId, OpenQuestionId } from '@goodboy/types';
import type { SetFn } from './types';

export const requestOpenQuestionScroll = (set: SetFn) => {
  return (target: { agentId: AgentId; questionId: OpenQuestionId }) => {
    set(() => ({ openQuestionScrollTarget: target }));
  };
};

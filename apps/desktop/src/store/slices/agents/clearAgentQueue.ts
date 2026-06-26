import type { AgentId } from '@goodboy/types';
import type { SetFn } from './types';

export const clearAgentQueue = (set: SetFn) => {
  return (agentId: AgentId) => {
    set((s) => {
      if (!(agentId in s.agentQueue)) {
        return s;
      }
      const next = { ...s.agentQueue };
      delete next[agentId];
      return { agentQueue: next };
    });
  };
};

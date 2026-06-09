import type { AgentId } from '@goodboy/types';
import type { SetFn } from './types';

export const clearAgentDraft = (set: SetFn) => {
  return (agentId: AgentId) => {
    set((s) => {
      if (!(agentId in s.agentDraft)) return s;
      const next = { ...s.agentDraft };
      delete next[agentId];
      return { agentDraft: next };
    });
  };
};

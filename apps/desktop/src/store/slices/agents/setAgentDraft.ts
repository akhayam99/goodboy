import type { AgentId } from '@goodboy/types';
import type { SetFn } from './types';

export const setAgentDraft = (set: SetFn) => {
  return (agentId: AgentId, value: string) => {
    set((s) => ({ agentDraft: { ...s.agentDraft, [agentId]: value } }));
  };
};

import type { AgentId } from '@goodboy/types';
import { storedAgentDraft } from './storedAgentDraft';
import type { SetFn } from './types';

export const setAgentDraft = (set: SetFn) => {
  return (agentId: AgentId, value: string) => {
    set((s) => ({ agentDraft: { ...s.agentDraft, [agentId]: value } }));
    storedAgentDraft.write({ agentId, text: value });
  };
};

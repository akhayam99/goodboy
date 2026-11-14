import { create } from 'zustand';
import type { AgentId } from '@goodboy/types';

type SelectParams = {
  readonly leadAgentId: AgentId;
  readonly agentId: AgentId | null;
};

type LeadSelectionState = {
  readonly selectedByLead: Readonly<Record<string, AgentId | null>>;
  readonly select: (params: SelectParams) => void;
};

export const useLeadSelectionStore = create<LeadSelectionState>()((set) => ({
  selectedByLead: {},
  select: ({ leadAgentId, agentId }) =>
    set((state) => ({ selectedByLead: { ...state.selectedByLead, [leadAgentId]: agentId } })),
}));

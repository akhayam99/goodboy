import type { AgentId, SessionId } from '@goodboy/types';
import type { SetFn } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export const dismissCheckProposal = (set: SetFn) => {
  return ({ sessionId, agentId }: Params): void => {
    set((state) => {
      const current = state.dismissedCheckProposals[sessionId] ?? [];
      if (current.includes(agentId)) {
        return state;
      }
      return {
        dismissedCheckProposals: {
          ...state.dismissedCheckProposals,
          [sessionId]: [...current, agentId],
        },
      };
    });
  };
};

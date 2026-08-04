import type { AgentId } from '@goodboy/types';
import { dropPendingTurnEvents } from './buffer';
import type { SetFn } from './types';

export const resetTranscript = (set: SetFn) => {
  return (agentId: AgentId) => {
    dropPendingTurnEvents({ agentId });
    set((state) => ({
      transcripts: { ...state.transcripts, [agentId]: [] },
    }));
  };
};

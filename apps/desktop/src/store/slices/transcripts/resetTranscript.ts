import type { AgentId } from '@goodboy/types';
import type { SetFn } from './types';

export const resetTranscript = (set: SetFn) => {
  return (agentId: AgentId) => {
    set((state) => ({
      transcripts: { ...state.transcripts, [agentId]: [] },
    }));
  };
};

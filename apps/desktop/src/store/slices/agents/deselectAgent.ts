import type { SessionId } from '@goodboy/types';
import type { SetFn } from './types';

export const deselectAgent = (set: SetFn) => {
  return (sessionId: SessionId): void => {
    set((s) => {
      if (s.selectedAgentId[sessionId] == null) {
        return {};
      }
      const next = { ...s.selectedAgentId };
      delete next[sessionId];
      return { selectedAgentId: next };
    });
  };
};

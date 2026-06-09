import type { SessionId } from '@goodboy/types';
import type { SetFn } from './types';

export const clearSessionNextActions = (set: SetFn) => {
  return (sessionId: SessionId) => {
    set((state) => {
      if (state.sessionNextActions[sessionId] === undefined) {
        return {};
      }
      const next = { ...state.sessionNextActions };
      delete next[sessionId];
      return { sessionNextActions: next };
    });
  };
};

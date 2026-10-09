import type { SessionId } from '@goodboy/types';
import type { SetFn } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly isFolded: boolean;
};

export const setSessionPagesFolded = (set: SetFn) => {
  return ({ sessionId, isFolded }: Params): void => {
    set((state) => {
      if ((state.sessionPagesFolded[sessionId] ?? false) === isFolded) {
        return state;
      }
      const next: Record<SessionId, boolean> = { ...state.sessionPagesFolded };
      if (!isFolded) {
        delete next[sessionId];
        return { sessionPagesFolded: next };
      }
      next[sessionId] = true;
      return { sessionPagesFolded: next };
    });
  };
};

import type { SessionId } from '@goodboy/types';

const told = new Set<SessionId>();

type Params = {
  readonly sessionId: SessionId;
};

export const unreadableDockGrids = {
  takeNotice: ({ sessionId }: Params): boolean => {
    if (told.has(sessionId)) {
      return false;
    }
    told.add(sessionId);
    return true;
  },
};

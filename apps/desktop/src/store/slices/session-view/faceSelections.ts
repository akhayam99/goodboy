import type { SessionId } from '@goodboy/types';

type Params = {
  readonly sessionId: SessionId;
};

const revisions = new Map<SessionId, number>();

export const faceSelections = {
  read: ({ sessionId }: Params): number => revisions.get(sessionId) ?? 0,
  bump: ({ sessionId }: Params): void => {
    revisions.set(sessionId, (revisions.get(sessionId) ?? 0) + 1);
  },
};

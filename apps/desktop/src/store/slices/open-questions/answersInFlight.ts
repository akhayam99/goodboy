import type { SessionId } from '@goodboy/types';

type Params = Readonly<{
  sessionId: SessionId;
}>;

const counts = new Map<SessionId, number>();

export const answersInFlight = {
  begin: ({ sessionId }: Params): void => {
    counts.set(sessionId, (counts.get(sessionId) ?? 0) + 1);
  },
  end: ({ sessionId }: Params): void => {
    const left = (counts.get(sessionId) ?? 1) - 1;
    if (left <= 0) {
      counts.delete(sessionId);
      return;
    }
    counts.set(sessionId, left);
  },
  has: ({ sessionId }: Params): boolean => (counts.get(sessionId) ?? 0) > 0,
};

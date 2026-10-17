import type { SessionId } from '@goodboy/types';

type SessionParams = {
  readonly sessionId: SessionId;
};

const mounted = new Map<SessionId, number>();

export const sessionSpendLines = {
  mount: ({ sessionId }: SessionParams): (() => void) => {
    mounted.set(sessionId, (mounted.get(sessionId) ?? 0) + 1);
    return () => {
      const count = (mounted.get(sessionId) ?? 1) - 1;
      if (count <= 0) {
        mounted.delete(sessionId);
        return;
      }
      mounted.set(sessionId, count);
    };
  },
  isShown: ({ sessionId }: SessionParams): boolean => (mounted.get(sessionId) ?? 0) > 0,
};

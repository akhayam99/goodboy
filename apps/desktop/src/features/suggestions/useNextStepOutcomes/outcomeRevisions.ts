import type { SessionId } from '@goodboy/types';

type SessionParams = {
  readonly sessionId: SessionId;
};

type SubscribeParams = SessionParams & {
  readonly listener: () => void;
};

const revisions = new Map<SessionId, number>();

const listeners = new Map<SessionId, Set<() => void>>();

export const OUTCOME_REVISIONS = {
  read: ({ sessionId }: SessionParams): number => revisions.get(sessionId) ?? 0,
  bump: ({ sessionId }: SessionParams): void => {
    revisions.set(sessionId, (revisions.get(sessionId) ?? 0) + 1);
    listeners.get(sessionId)?.forEach((listener) => listener());
  },
  subscribe: ({ sessionId, listener }: SubscribeParams): (() => void) => {
    const own = listeners.get(sessionId) ?? new Set<() => void>();
    own.add(listener);
    listeners.set(sessionId, own);
    return () => {
      own.delete(listener);
      if (own.size === 0) {
        listeners.delete(sessionId);
      }
    };
  },
};

import type { SessionId } from '@goodboy/types';

type Listener = () => void;

type SessionParams = {
  readonly sessionId: SessionId;
};

type SubscribeParams = {
  readonly listener: Listener;
};

const listeners = new Set<Listener>();

let pendingSessionId: SessionId | null = null;

export const LOG_LANDING = {
  request: ({ sessionId }: SessionParams): void => {
    pendingSessionId = sessionId;
    for (const listener of listeners) {
      listener();
    }
  },
  take: ({ sessionId }: SessionParams): boolean => {
    if (pendingSessionId !== sessionId) {
      return false;
    }
    pendingSessionId = null;
    return true;
  },
  subscribe: ({ listener }: SubscribeParams): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

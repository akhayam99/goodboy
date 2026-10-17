import type { SessionId } from '@goodboy/types';

type AttachParams = {
  readonly sessionId: SessionId;
  readonly start: () => void;
};

type SessionParams = {
  readonly sessionId: SessionId;
};

const hosts = new Map<SessionId, () => void>();

export const overviewTitleHost = {
  attach: ({ sessionId, start }: AttachParams): (() => void) => {
    hosts.set(sessionId, start);
    return () => {
      if (hosts.get(sessionId) === start) {
        hosts.delete(sessionId);
      }
    };
  },
  start: ({ sessionId }: SessionParams): boolean => {
    const start = hosts.get(sessionId);
    if (start === undefined) {
      return false;
    }
    start();
    return true;
  },
};

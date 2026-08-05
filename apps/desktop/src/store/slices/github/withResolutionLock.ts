import type { SessionId } from '@goodboy/types';

const resolutionWritesInFlight = new Set<SessionId>();

type Params<T> = {
  readonly sessionId: SessionId;
  readonly onBusy: () => T;
  readonly run: () => Promise<T>;
};

export const withResolutionLock = async <T>({ sessionId, onBusy, run }: Params<T>): Promise<T> => {
  if (resolutionWritesInFlight.has(sessionId)) {
    return onBusy();
  }
  resolutionWritesInFlight.add(sessionId);
  try {
    return await run();
  } finally {
    resolutionWritesInFlight.delete(sessionId);
  }
};

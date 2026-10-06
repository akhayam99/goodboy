import type { SessionId } from '@goodboy/types';

const writes = new Map<SessionId, Promise<void>>();

type TrackParams = {
  readonly sessionId: SessionId;
  readonly write: Promise<void>;
};

export const trackAskRoutingWrite = ({ sessionId, write }: TrackParams): void => {
  writes.set(sessionId, write);
  write.catch(() => undefined);
};

type SettleParams = {
  readonly sessionId: SessionId;
};

export const settleAskRoutingWrite = async ({ sessionId }: SettleParams): Promise<void> => {
  await writes.get(sessionId);
};

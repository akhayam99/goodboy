import type { SessionId } from '@goodboy/types';

const latestRequest = new Map<string, number>();

type Params = {
  readonly sessionId: SessionId;
  readonly key: string;
};

export const beginThreadRequest = ({ sessionId, key }: Params): (() => boolean) => {
  const slot = `${sessionId}\u0000${key}`;
  const token = (latestRequest.get(slot) ?? 0) + 1;
  latestRequest.set(slot, token);
  return () => latestRequest.get(slot) === token;
};

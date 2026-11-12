import type { SessionId } from '@goodboy/types';
import { createLatestOnly } from '../../runtime/state-writes/latestOnly';

type KeyParams = {
  readonly sessionId: SessionId;
};

export const browserVisitWrites = {
  loads: createLatestOnly(),
  loadKey: ({ sessionId }: KeyParams) => `browser-visits:${sessionId}`,
};

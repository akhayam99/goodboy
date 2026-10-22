import type { SessionId } from '@goodboy/types';

type Params = {
  readonly sessionId: SessionId | null;
};

export const startRunEventName = ({ sessionId }: Params): string =>
  `goodboy:start-run:${sessionId ?? 'new'}`;

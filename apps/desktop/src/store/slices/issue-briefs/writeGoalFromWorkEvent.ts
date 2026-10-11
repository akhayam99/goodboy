import type { SessionId } from '@goodboy/types';

type Params = { readonly sessionId: SessionId };

export const writeGoalFromWorkEvent = ({ sessionId }: Params): string =>
  `goodboy:write-from-work:${sessionId}`;

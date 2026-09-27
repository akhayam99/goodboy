import type { SessionId } from '@goodboy/types';

export const newArtifactEventName = (sessionId: SessionId): string =>
  `goodboy:open-new-artifact:${sessionId}`;

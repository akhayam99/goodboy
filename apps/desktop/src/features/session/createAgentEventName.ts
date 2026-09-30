import type { SessionId } from '@goodboy/types';

export const createAgentEventName = (sessionId: SessionId): string =>
  `goodboy:open-create-agent:${sessionId}`;

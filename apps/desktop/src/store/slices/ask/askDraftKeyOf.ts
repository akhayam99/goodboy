import type { ChatId, SessionId } from '@goodboy/types';

type Params = {
  readonly sessionId: SessionId;
  readonly threadId: ChatId | null;
};

export const askDraftKeyOf = ({ sessionId, threadId }: Params): string =>
  threadId === null ? `${sessionId}:new` : threadId;

import type { IsoDateTime, MessageId, SessionId } from './ids';

export type MessageRole = 'user' | 'assistant' | 'system';

export type Message = Readonly<{
  id: MessageId;
  sessionId: SessionId;
  role: MessageRole;
  content: string;
  createdAt: IsoDateTime;
}>;

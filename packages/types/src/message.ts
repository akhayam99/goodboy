import type { AgentId, IsoDateTime, MessageId, SessionId } from './ids';
import type { TurnProviderOverride } from './provider-preference';

export type MessageRole = 'user' | 'assistant' | 'system';

export type MessageAttachment = Readonly<{
  id: string;
  kind: 'image' | 'file';
  fileName: string;
  mimeType: string;
  relPath: string;
}>;

export type AttachmentInput = Readonly<{
  id: string;
  fileName: string;
  mimeType: string;
  dataBase64: string;
}>;

export type Message = Readonly<{
  id: MessageId;
  sessionId: SessionId;
  agentId: AgentId;
  role: MessageRole;
  content: string;
  createdAt: IsoDateTime;
  providerOverride?: TurnProviderOverride;
}>;

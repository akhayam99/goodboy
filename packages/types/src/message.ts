import type { IsoDateTime, MessageId, SessionId, TaskId } from './ids';
import type { TurnProviderOverride } from './provider-preference';

export type MessageRole = 'user' | 'assistant' | 'system';

export type Message = Readonly<{
  id: MessageId;
  taskId: TaskId;
  agentId: SessionId;
  role: MessageRole;
  content: string;
  createdAt: IsoDateTime;
  providerOverride?: TurnProviderOverride;
}>;

import type { IsoDateTime, MessageId, TaskId } from './ids';
import type { TurnProviderOverride } from './provider-preference';

export type MessageRole = 'user' | 'assistant' | 'system';

export type Message = Readonly<{
  id: MessageId;
  taskId: TaskId;
  role: MessageRole;
  content: string;
  createdAt: IsoDateTime;
  providerOverride?: TurnProviderOverride;
}>;

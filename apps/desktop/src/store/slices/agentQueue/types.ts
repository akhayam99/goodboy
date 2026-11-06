import type { AgentId, IsoDateTime, TurnProviderOverride } from '@goodboy/types';
import type { StoredAttachment } from '../../../features/attachments/pendingAttachment';

export type { SetFn, GetFn } from '../../slice-types';

export type QueuedAttachment = StoredAttachment;

export type AgentQueuedStatus = 'queued' | 'sending';

export type AgentQueuedTurnInput = Readonly<{
  id: string;
  agentId: AgentId;
  content: string;
  attachments: ReadonlyArray<QueuedAttachment>;
  override: TurnProviderOverride | undefined;
}>;

export type AgentQueueHold = Readonly<{
  reason: string;
}>;

export type AgentQueuedTurn = AgentQueuedTurnInput &
  Readonly<{
    status: AgentQueuedStatus;
    createdAt: IsoDateTime;
    isDirect?: boolean;
    hold?: AgentQueueHold;
    writtenTexts?: number;
    isTextShown?: boolean;
  }>;

export type AgentQueueItemParams = Readonly<{
  agentId: AgentId;
  itemId: string;
}>;

export type QueuedTurnDelivery = Readonly<{
  isDelivered: boolean;
  failure: string | null;
}>;

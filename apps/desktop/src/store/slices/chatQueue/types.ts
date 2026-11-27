import type { ChatId } from '@goodboy/types';
import type { PendingAttachment } from '../../../features/attachments/pendingAttachment';

export type { GetFn, SetFn, SliceDeps } from '../../slice-types';

export type QueuedChatTurnStatus = 'queued' | 'failed';

export type QueuedChatTurn = {
  readonly id: string;
  readonly content: string;
  readonly attachments: ReadonlyArray<PendingAttachment>;
  readonly status: QueuedChatTurnStatus;
  readonly failure: string | null;
};

export type QueuedChatTarget = {
  readonly chatId: ChatId;
  readonly itemId: string;
};

export type QueueChatMessageParams = {
  readonly chatId: ChatId;
  readonly content: string;
  readonly attachments: ReadonlyArray<PendingAttachment>;
};

export type DrainChatQueueParams = {
  readonly chatId: ChatId;
  readonly itemId?: string;
};

import type { TurnProviderOverride } from '@goodboy/types';
import type { AttachmentStripItem } from '../../attachments/AttachmentStrip';
import type { PendingMessageAction } from '../../auto/chat/pendingMessageOf';

export type QueuedRowStatus = 'queued' | 'sending' | 'waits' | 'notDelivered';

export type QueuedRow = Readonly<{
  id: string;
  source: 'agent' | 'auto';
  content: string;
  images: ReadonlyArray<AttachmentStripItem>;
  imageCount: number;
  override: TurnProviderOverride | undefined;
  status: QueuedRowStatus;
  statusText: string;
  reason: string | null;
  action: PendingMessageAction | null;
}>;

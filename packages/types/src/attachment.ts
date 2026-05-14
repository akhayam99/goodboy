import type { IsoDateTime, MessageId, SessionId, TaskId } from './ids';

export type AttachmentMime = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';

export const ATTACHMENT_MIME_TYPES: ReadonlyArray<AttachmentMime> = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];

// 5 MB per image — matches anthropic's per-image limit so we reject before
// hitting CLI failure. 8 images per turn matches anthropic's hard cap.
export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const ATTACHMENT_MAX_PER_TURN = 8;

export interface AttachmentRef {
  readonly sha256: string;
  readonly mime: AttachmentMime;
  readonly sizeBytes: number;
}

export interface Attachment extends AttachmentRef {
  readonly id: string;
  readonly taskId: TaskId;
  readonly agentId: SessionId;
  readonly messageId: MessageId;
  readonly createdAt: IsoDateTime;
}

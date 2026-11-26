import { vi } from 'vitest';
import type { readAttachment, writeAttachment } from '../../features/chat/turn';

export const attachmentSpies = {
  writeAttachment: vi.fn<typeof writeAttachment>(async () => '.goodboy/attachments/spec.pdf'),
  readAttachment: vi.fn<typeof readAttachment>(
    async () => 'data:image/png;base64,aGFyYm9ybGluZQ==',
  ),
};

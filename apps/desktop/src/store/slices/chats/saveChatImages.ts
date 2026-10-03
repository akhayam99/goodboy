import type {
  ChatAttachmentId,
  ChatId,
  ChatMessageAttachment,
  ChatMessageId,
  IsoDateTime,
} from '@goodboy/types';
import type { PendingAttachment } from '../../../features/attachments/pendingAttachment';
import { activeChatBackend } from '../../../features/workspace-chat/activeChatBackend';
import { chatImageFileName, chatImageMime } from '../../../features/workspace-chat/chatImageKinds';

type Params = {
  readonly chatId: ChatId;
  readonly messageId: ChatMessageId;
  readonly attachments: ReadonlyArray<PendingAttachment>;
  readonly at: IsoDateTime;
};

export const saveChatImages = async ({
  chatId,
  messageId,
  attachments,
  at,
}: Params): Promise<ReadonlyArray<ChatMessageAttachment>> => {
  const saved: ChatMessageAttachment[] = [];
  for (const [position, attachment] of attachments.entries()) {
    const attachmentId = attachment.id as ChatAttachmentId;
    const mimeType = chatImageMime({
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
    });
    const fileName = chatImageFileName({ fileName: attachment.fileName, mimeType });
    const byteSize = await activeChatBackend.writeImage({
      chatId,
      attachmentId,
      fileName,
      blob: attachment.blob,
    });
    saved.push({
      id: attachmentId,
      chatId,
      messageId,
      position,
      fileName,
      mimeType,
      byteSize,
      createdAt: at,
    });
  }
  return saved;
};

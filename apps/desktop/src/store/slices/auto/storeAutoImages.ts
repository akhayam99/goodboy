import type { AttachmentInput, MessageAttachment, SessionId } from '@goodboy/types';
import { writeAttachment } from '../../../features/chat/turn';
import { scratchDirPrepare } from '../../../features/worktree/worktree';

type Params = {
  readonly sessionId: SessionId;
  readonly images: ReadonlyArray<AttachmentInput>;
};

export const storeAutoImages = async ({
  sessionId,
  images,
}: Params): Promise<ReadonlyArray<MessageAttachment>> => {
  if (images.length === 0) {
    return [];
  }
  const dir = await scratchDirPrepare({ sessionId });
  return Promise.all(
    images.map(async (image): Promise<MessageAttachment> => {
      const relPath = await writeAttachment({
        worktreeDir: dir,
        attachmentId: image.id,
        fileName: image.fileName,
        dataBase64: image.dataBase64,
      });
      return {
        id: image.id,
        kind: 'image',
        fileName: image.fileName,
        mimeType: image.mimeType,
        relPath,
        dir,
      };
    }),
  );
};

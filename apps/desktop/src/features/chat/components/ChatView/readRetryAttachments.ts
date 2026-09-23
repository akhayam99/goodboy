import type { AttachmentInput, MessageAttachment } from '@goodboy/types';
import { readAttachment } from '../../turn';
import { dataUrlToBase64 } from '../ChatInput/lib';

type Params = {
  readonly worktreePath: string | null;
  readonly attachments: ReadonlyArray<MessageAttachment>;
};

export type RetryAttachments = {
  readonly inputs: ReadonlyArray<AttachmentInput>;
  readonly missing: ReadonlyArray<string>;
};

export const readRetryAttachments = async ({
  worktreePath,
  attachments,
}: Params): Promise<RetryAttachments> => {
  if (attachments.length === 0) {
    return { inputs: [], missing: [] };
  }
  if (worktreePath === null) {
    return { inputs: [], missing: attachments.map((attachment) => attachment.fileName) };
  }
  const inputs: AttachmentInput[] = [];
  const missing: string[] = [];
  for (const attachment of attachments) {
    try {
      const dataUrl = await readAttachment(worktreePath, attachment.relPath);
      inputs.push({
        id: attachment.id,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        dataBase64: dataUrlToBase64(dataUrl),
      });
    } catch {
      missing.push(attachment.fileName);
    }
  }
  return { inputs, missing };
};

export const missingAttachmentsMessage = ({
  missing,
}: {
  readonly missing: ReadonlyArray<string>;
}): string =>
  missing.length === 1
    ? `retried without ${missing[0]}: the file is no longer readable`
    : `retried without ${missing.join(', ')}: the files are no longer readable`;

import type { DraftAttachment } from '../../../../../../store/slices/agents/setAgentAttachments';
import type { PendingAttachment } from '../../../../../attachments/pendingAttachment';

type Params = {
  readonly sent: ReadonlyArray<PendingAttachment>;
  readonly current: ReadonlyArray<DraftAttachment>;
};

export const mergeFailedDraftAttachments = ({
  sent,
  current,
}: Params): ReadonlyArray<DraftAttachment> => {
  const sentDrafts = sent.flatMap((attachment) =>
    attachment.relPath === null
      ? []
      : [
          {
            id: attachment.id,
            fileName: attachment.fileName,
            mimeType: attachment.mimeType,
            relPath: attachment.relPath,
          },
        ],
  );
  const sentIds = new Set(sentDrafts.map((attachment) => attachment.id));
  return [...sentDrafts, ...current.filter((attachment) => !sentIds.has(attachment.id))];
};

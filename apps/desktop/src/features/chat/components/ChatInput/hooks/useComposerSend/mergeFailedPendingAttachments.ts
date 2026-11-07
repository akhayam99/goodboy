import type { PendingAttachment } from '../../../../../attachments/pendingAttachment';

type Params = {
  readonly sent: ReadonlyArray<PendingAttachment>;
  readonly current: ReadonlyArray<PendingAttachment>;
};

export const mergeFailedPendingAttachments = ({
  sent,
  current,
}: Params): ReadonlyArray<PendingAttachment> => {
  const sentIds = new Set(sent.map((attachment) => attachment.id));
  return [...sent, ...current.filter((attachment) => !sentIds.has(attachment.id))];
};

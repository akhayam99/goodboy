import type { PendingAttachment } from '../../../features/attachments/pendingAttachment';
import { PendingAttachmentChip } from '../../../features/attachments/components/PendingAttachmentChip';

type Props = {
  readonly attachment: PendingAttachment;
  readonly onRemove: () => void;
};

export const PromptAttachmentChip = ({ attachment, onRemove }: Props) => (
  <PendingAttachmentChip attachment={attachment} onRemove={onRemove} />
);

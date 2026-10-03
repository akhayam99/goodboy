import type { PendingAttachment } from '../pendingAttachment';
import { useObjectUrl } from '../hooks/useObjectUrl';
import { AttachmentChip, pendingAttachmentProps } from './AttachmentChip';

type Props = {
  readonly attachment: PendingAttachment;
  readonly onRemove?: () => void;
};

export const PendingAttachmentChip = ({ attachment, onRemove }: Props) => {
  const url = useObjectUrl({ blob: attachment.blob });
  return (
    <AttachmentChip
      {...pendingAttachmentProps({ attachment, url })}
      title={attachment.fileName}
      {...(onRemove !== undefined && { onRemove })}
    />
  );
};

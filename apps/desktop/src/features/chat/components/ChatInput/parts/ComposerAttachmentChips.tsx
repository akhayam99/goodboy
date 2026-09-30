import type { PendingAttachment } from '../../../../attachments/pendingAttachment';
import {
  AttachmentChip,
  pendingAttachmentProps,
} from '../../../../attachments/components/AttachmentChip';

type Props = {
  readonly attachments: ReadonlyArray<PendingAttachment>;
  readonly onRemove: (id: string) => void;
};

export const ComposerAttachmentChips = ({ attachments, onRemove }: Props) => {
  if (attachments.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-2 px-3 pb-1 pt-3">
      {attachments.map((a) => (
        <AttachmentChip key={a.id} {...pendingAttachmentProps(a)} onRemove={() => onRemove(a.id)} />
      ))}
    </div>
  );
};

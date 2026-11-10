import type { ComponentProps } from 'react';
import { PromptAttachmentChip } from '../PromptField/PromptAttachmentChip';

type Attachment = ComponentProps<typeof PromptAttachmentChip>['attachment'];

type Props = {
  readonly attachments: ReadonlyArray<Attachment>;
  readonly onRemove: (id: string) => void;
};

export const ComposerAttachments = ({ attachments, onRemove }: Props) => {
  if (attachments.length === 0) {
    return null;
  }
  return (
    <div data-composer-attachments="" className="flex flex-wrap gap-2 px-3 pb-1 pt-3">
      {attachments.map((attachment) => (
        <PromptAttachmentChip
          key={attachment.id}
          attachment={attachment}
          onRemove={() => onRemove(attachment.id)}
        />
      ))}
    </div>
  );
};

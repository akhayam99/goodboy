import { useEffect, useRef } from 'react';
import { AttachmentChip } from '../../../attachments/components/AttachmentChip';
import { useAttachmentThumbnail } from '../../../attachments/hooks/useAttachmentThumbnail';
import { attachmentKindFor } from '../../../chat/attachment-kinds';
import { readAttachment } from '../../../chat/turn';
import type { ArtifactAttachment } from '../../artifactAttachments';

type Props = {
  readonly attachment: ArtifactAttachment;
  readonly worktree: string | null;
  readonly onRemove: () => void;
  readonly onMissing: () => void;
};

export const ArtifactAttachmentChip = ({ attachment, worktree, onRemove, onMissing }: Props) => {
  const kind = attachmentKindFor(attachment.mimeType);
  const thumbnail = useAttachmentThumbnail({
    kind,
    relPath: attachment.relPath,
    workingDir: worktree,
  });
  const onMissingRef = useRef(onMissing);
  onMissingRef.current = onMissing;

  useEffect(() => {
    if (kind !== 'image' || worktree === null || thumbnail.status !== 'failed') {
      return;
    }
    onMissingRef.current();
  }, [kind, worktree, thumbnail.status]);

  const lazyPreview =
    worktree === null
      ? undefined
      : {
          load: () => readAttachment(worktree, attachment.relPath),
          media: attachment.mimeType === 'application/pdf' ? ('pdf' as const) : undefined,
        };

  return (
    <AttachmentChip
      fileName={attachment.fileName}
      mimeType={attachment.mimeType}
      thumbnail={kind === 'image' ? thumbnail : undefined}
      lazyPreview={lazyPreview}
      title={attachment.relPath}
      onRemove={onRemove}
    />
  );
};

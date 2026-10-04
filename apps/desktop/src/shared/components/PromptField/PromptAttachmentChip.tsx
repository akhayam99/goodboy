import { X } from 'lucide-react';
import { IconButton } from '@goodboy/ui';
import type { PendingAttachment } from '../../../features/attachments/pendingAttachment';
import { useObjectUrl } from '../../../features/attachments/hooks/useObjectUrl';
import { attachmentKindFor, fileIconFor } from '../../../features/chat/attachment-kinds';
import { ICON_SIZE } from '../conceptIcons';

type Props = {
  readonly attachment: PendingAttachment;
  readonly onRemove: () => void;
};

type SizeParams = {
  readonly bytes: number;
};

const formatSize = ({ bytes }: SizeParams): string =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export const PromptAttachmentChip = ({ attachment, onRemove }: Props) => {
  const url = useObjectUrl({ blob: attachment.blob });
  const isImage = attachmentKindFor(attachment.mimeType) === 'image';
  const Icon = fileIconFor(attachment.mimeType);
  return (
    <span
      data-testid="prompt-attachment"
      className="flex h-8 min-w-0 max-w-full items-center gap-2 rounded-md bg-background pl-1 pr-0.5 ring-1 ring-border-soft"
    >
      <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-elevated text-faint-foreground">
        {isImage && url !== null ? (
          <img src={url} alt="" className="size-full object-cover" />
        ) : (
          <Icon size={ICON_SIZE.control} aria-hidden />
        )}
      </span>
      <span className="min-w-0 max-w-40 truncate text-meta text-foreground">
        {attachment.fileName}
      </span>
      <span className="shrink-0 text-meta tabular-nums text-faint-foreground">
        {formatSize({ bytes: attachment.blob.size })}
      </span>
      <IconButton
        icon={X}
        label={`Remove ${attachment.fileName}`}
        variant="ghost"
        iconSize={ICON_SIZE.row}
        onClick={onRemove}
      />
    </span>
  );
};

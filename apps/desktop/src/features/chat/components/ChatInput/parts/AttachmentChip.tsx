import { useState } from 'react';
import { X } from 'lucide-react';
import { ImageLightbox } from '../../ImageLightbox';
import { attachmentKindFor, fileIconFor } from '../../../attachment-kinds';
import { dataUrlToBase64, type PendingAttachment } from '../lib';

export function AttachmentChip({
  attachment,
  onRemove,
}: {
  readonly attachment: PendingAttachment;
  readonly onRemove: () => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const removeButton = (
    <button
      type="button"
      onClick={onRemove}
      title={`Remove ${attachment.fileName}`}
      aria-label={`Remove ${attachment.fileName}`}
      className="absolute right-0.5 top-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-foreground/70 text-background opacity-0 transition-opacity hover:bg-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] group-hover:opacity-100"
    >
      <X size={10} aria-hidden />
    </button>
  );

  if (attachmentKindFor(attachment.mimeType) === 'image') {
    return (
      <div className="group relative h-16 w-16 overflow-hidden rounded-md ring-1 ring-border-soft">
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          title={`Preview ${attachment.fileName}`}
          aria-label={`Preview ${attachment.fileName}`}
          className="block h-full w-full cursor-zoom-in"
        >
          <img
            src={attachment.dataUrl}
            alt={attachment.fileName}
            className="h-full w-full object-cover"
          />
        </button>
        {previewOpen ? (
          <ImageLightbox
            src={attachment.dataUrl}
            alt={attachment.fileName}
            onClose={() => setPreviewOpen(false)}
          />
        ) : null}
        {removeButton}
      </div>
    );
  }

  const Icon = fileIconFor(attachment.mimeType);
  const isPdf = attachment.mimeType === 'application/pdf';
  return (
    <div className="group relative flex h-16 max-w-[12rem] items-center gap-2 rounded-md bg-background/60 py-2 pl-2.5 pr-6 ring-1 ring-border-soft">
      <button
        type="button"
        disabled={!isPdf}
        onClick={() => setPreviewOpen(true)}
        title={isPdf ? `preview ${attachment.fileName}` : attachment.fileName}
        aria-label={isPdf ? `preview ${attachment.fileName}` : attachment.fileName}
        className="flex min-w-0 items-center gap-2 enabled:cursor-zoom-in"
      >
        <Icon size={18} aria-hidden className="shrink-0 text-muted-foreground" />
        <span className="truncate text-xs text-foreground/80">{attachment.fileName}</span>
      </button>
      {previewOpen && isPdf ? (
        <ImageLightbox
          media="pdf"
          src={`data:application/pdf;base64,${dataUrlToBase64(attachment.dataUrl)}`}
          alt={attachment.fileName}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
      {removeButton}
    </div>
  );
}

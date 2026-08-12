import { useState } from 'react';
import { ImageOff, X } from 'lucide-react';
import { Skeleton } from '@goodboy/ui';
import { attachmentKindFor, fileIconFor } from '../../../chat/attachment-kinds';
import { ImageLightbox } from '../../../chat/components/ImageLightbox';
import { dataUrlToBase64, type PendingAttachment } from '../../../chat/components/ChatInput/lib';

export type AttachmentThumbnail =
  | { readonly status: 'ready'; readonly src: string }
  | { readonly status: 'loading' }
  | { readonly status: 'failed' };

type Props = {
  readonly fileName: string;
  readonly mimeType: string;
  readonly thumbnail?: AttachmentThumbnail;
  readonly preview?: { readonly src: string; readonly media?: 'image' | 'pdf' };
  readonly lazyPreview?: {
    readonly load: () => Promise<string>;
    readonly media?: 'image' | 'pdf';
  };
  readonly title?: string;
  readonly onRemove?: () => void;
};

export const pendingAttachmentProps = (attachment: PendingAttachment) => {
  const shared = { fileName: attachment.fileName, mimeType: attachment.mimeType };
  if (attachmentKindFor(attachment.mimeType) === 'image') {
    return {
      ...shared,
      thumbnail: { status: 'ready', src: attachment.dataUrl } as const,
      preview: { src: attachment.dataUrl },
    };
  }
  if (attachment.mimeType === 'application/pdf') {
    return {
      ...shared,
      preview: {
        src: `data:application/pdf;base64,${dataUrlToBase64(attachment.dataUrl)}`,
        media: 'pdf' as const,
      },
    };
  }
  return shared;
};

export const AttachmentChip = ({
  fileName,
  mimeType,
  thumbnail,
  preview,
  lazyPreview,
  title,
  onRemove,
}: Props) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loadedPreview, setLoadedPreview] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  const resolvedPreview =
    preview ?? (loadedPreview == null ? null : { src: loadedPreview, media: lazyPreview?.media });
  const canPreview = preview != null || lazyPreview != null;

  const openPreview = () => {
    if (resolvedPreview != null) {
      setPreviewOpen(true);
      return;
    }
    if (lazyPreview == null || previewBusy) {
      return;
    }
    setPreviewBusy(true);
    lazyPreview
      .load()
      .then((src) => {
        setLoadedPreview(src);
        setPreviewOpen(true);
      })
      .catch(() => undefined)
      .finally(() => setPreviewBusy(false));
  };

  const removeButton =
    onRemove == null ? null : (
      <button
        type="button"
        onClick={onRemove}
        title={`Remove ${fileName}`}
        aria-label={`Remove ${fileName}`}
        className="absolute right-0.5 top-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-foreground/70 text-background opacity-0 transition-opacity hover:bg-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] group-hover:opacity-100"
      >
        <X size={10} aria-hidden />
      </button>
    );

  const lightbox =
    previewOpen && resolvedPreview != null ? (
      <ImageLightbox
        src={resolvedPreview.src}
        media={resolvedPreview.media}
        alt={fileName}
        onClose={() => setPreviewOpen(false)}
      />
    ) : null;

  if (attachmentKindFor(mimeType) === 'image' && thumbnail != null) {
    return (
      <div
        className="group relative h-16 w-16 overflow-hidden rounded-md ring-1 ring-border-soft"
        title={title}
      >
        {thumbnail.status === 'loading' ? (
          <Skeleton className="h-full w-full rounded-none" />
        ) : thumbnail.status === 'failed' ? (
          <div className="flex h-full w-full items-center justify-center bg-foreground/5 text-muted-foreground">
            <ImageOff size={14} aria-hidden />
          </div>
        ) : !canPreview ? (
          <img src={thumbnail.src} alt={fileName} className="h-full w-full object-cover" />
        ) : (
          <button
            type="button"
            onClick={openPreview}
            title={`Preview ${fileName}`}
            aria-label={`Preview ${fileName}`}
            className="block h-full w-full cursor-zoom-in"
          >
            <img src={thumbnail.src} alt={fileName} className="h-full w-full object-cover" />
          </button>
        )}
        {lightbox}
        {removeButton}
      </div>
    );
  }

  const Icon = fileIconFor(mimeType);
  const body = (
    <>
      <Icon size={18} aria-hidden className="shrink-0 text-muted-foreground" />
      <span className="truncate text-xs text-foreground/80">{fileName}</span>
    </>
  );

  return (
    <div
      className="group relative flex h-16 max-w-[12rem] items-center gap-2 rounded-md bg-background/60 py-2 pl-2.5 pr-6 ring-1 ring-border-soft"
      title={title}
    >
      {!canPreview ? (
        <div className="flex min-w-0 items-center gap-2">{body}</div>
      ) : (
        <button
          type="button"
          onClick={openPreview}
          title={`Preview ${fileName}`}
          aria-label={`Preview ${fileName}`}
          className="flex min-w-0 cursor-zoom-in items-center gap-2"
        >
          {body}
        </button>
      )}
      {lightbox}
      {removeButton}
    </div>
  );
};

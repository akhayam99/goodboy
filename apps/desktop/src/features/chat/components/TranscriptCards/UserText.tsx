import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { Markdown, MetaRow, Skeleton } from '@goodboy/ui';
import type { MessageAttachment, ProviderId } from '@goodboy/types';
import { PROVIDER_BRAND, brandColor } from '../../../providers/components/provider-brand';
import { PROVIDER_LABEL, modelLabel } from '../../utils/chat-constants';
import { readAttachment } from '../../turn';
import { fileIconFor } from '../../attachment-kinds';
import { ImageLightbox } from '../ImageLightbox';
import { TranscriptShell } from '../TranscriptShell';
import { CopyButton } from '../../../../shared/components/CopyButton';

const formatHHMM = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

type AttachmentThumbProps = {
  attachment: MessageAttachment;
  workingDir: string | null;
};

const AttachmentThumb = ({ attachment, workingDir }: AttachmentThumbProps) => {
  if (attachment.kind === 'file') {
    return <AttachmentFileCard attachment={attachment} workingDir={workingDir} />;
  }
  return <AttachmentImage attachment={attachment} workingDir={workingDir} />;
};

type AttachmentImageProps = {
  attachment: MessageAttachment;
  workingDir: string | null;
};

const AttachmentImage = ({ attachment, workingDir }: AttachmentImageProps) => {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!workingDir) {
      setFailed(true);
      return;
    }
    let alive = true;
    setFailed(false);
    setSrc(null);
    readAttachment(workingDir, attachment.relPath)
      .then((dataUrl) => {
        if (alive) {
          setSrc(dataUrl);
        }
      })
      .catch(() => {
        if (alive) {
          setFailed(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [workingDir, attachment.relPath]);

  if (failed) {
    return (
      <div
        className="flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-lg bg-foreground/5 text-muted-foreground"
        title={attachment.fileName}
      >
        <ImageOff size={16} aria-hidden />
        <span className="max-w-[6.5rem] truncate px-1 text-2xs">{attachment.fileName}</span>
      </div>
    );
  }

  if (src === null) {
    return <Skeleton className="h-28 w-28 rounded-lg" />;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setPreviewOpen(true)}
        title={`preview ${attachment.fileName}`}
        aria-label={`preview ${attachment.fileName}`}
        className="cursor-zoom-in"
      >
        <img
          src={src}
          alt={attachment.fileName}
          className="max-h-60 max-w-full rounded-lg object-contain ring-1 ring-primary/20"
        />
      </button>
      {previewOpen ? (
        <ImageLightbox src={src} alt={attachment.fileName} onClose={() => setPreviewOpen(false)} />
      ) : null}
    </>
  );
};

type AttachmentFileCardProps = {
  attachment: MessageAttachment;
  workingDir: string | null;
};

const AttachmentFileCard = ({ attachment, workingDir }: AttachmentFileCardProps) => {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const Icon = fileIconFor(attachment.mimeType);
  const isPdf = attachment.mimeType === 'application/pdf';

  const openPreview = () => {
    if (!isPdf || !workingDir) {
      return;
    }
    if (src !== null) {
      setPreviewOpen(true);
      return;
    }
    setLoading(true);
    readAttachment(workingDir, attachment.relPath)
      .then((dataUrl) => {
        setSrc(dataUrl);
        setPreviewOpen(true);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  return (
    <>
      <button
        type="button"
        disabled={!isPdf}
        onClick={openPreview}
        title={isPdf ? `preview ${attachment.fileName}` : attachment.fileName}
        aria-label={isPdf ? `preview ${attachment.fileName}` : attachment.fileName}
        className="flex max-w-[16rem] items-center gap-2 rounded-lg bg-foreground/5 px-3 py-2 ring-1 ring-border-soft transition-colors enabled:cursor-zoom-in enabled:hover:bg-foreground/10"
      >
        <Icon size={16} aria-hidden className="shrink-0 text-muted-foreground" />
        <span className="truncate text-xs text-foreground/80">{attachment.fileName}</span>
        {loading ? (
          <span className="shrink-0 text-2xs text-muted-foreground">loading...</span>
        ) : null}
      </button>
      {previewOpen && src !== null ? (
        <ImageLightbox
          media="pdf"
          src={src}
          alt={attachment.fileName}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </>
  );
};

type Props = {
  text: string;
  at: string;
  attachments?: ReadonlyArray<MessageAttachment>;
  provider?: ProviderId;
  model?: string;
  workingDir?: string | null;
};

export const UserText = ({ text, at, attachments, provider, model, workingDir = null }: Props) => {
  const atts = attachments ?? [];
  return (
    <TranscriptShell
      tone="info"
      variant="boxed"
      className="ml-auto flex w-fit max-w-[85%] flex-col gap-1.5"
    >
      {atts.length > 0 && (
        <div className="flex flex-wrap justify-end gap-1.5">
          {atts.map((a) => (
            <AttachmentThumb key={a.id} attachment={a} workingDir={workingDir} />
          ))}
        </div>
      )}
      {text.length > 0 && (
        <div className="text-sm text-foreground">
          <Markdown text={text} />
        </div>
      )}
      <div className="flex items-center justify-end gap-1.5">
        <MetaRow
          items={[
            provider ? <ProviderFootnote key="provider" provider={provider} model={model} /> : null,
            provider && model ? <span key="model">{modelLabel(model)}</span> : null,
            <span key="time" className="font-mono">
              {formatHHMM(at)}
            </span>,
          ]}
        />
        {text.length > 0 && (
          <CopyButton
            value={text}
            label="copy message"
            className="rounded-md p-0.5 text-foreground/60 transition-opacity hover:opacity-80 hover:text-foreground"
          />
        )}
      </div>
    </TranscriptShell>
  );
};

type ProviderFootnoteProps = {
  provider: ProviderId;
  model?: string;
};

const ProviderFootnote = ({ provider, model }: ProviderFootnoteProps) => {
  const Icon = PROVIDER_BRAND[provider].icon;
  const label = PROVIDER_LABEL[provider];
  return (
    <span
      className="inline-flex items-center gap-1"
      title={`sent to ${label}${model ? ` · ${modelLabel(model)}` : ''}`}
    >
      <Icon size={11} aria-hidden style={{ color: brandColor(provider) }} />
      <span>{label}</span>
    </span>
  );
};

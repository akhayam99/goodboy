import { Markdown, MetaRow } from '@goodboy/ui';
import type { MessageAttachment, ProviderId } from '@goodboy/types';
import { PROVIDER_BRAND, brandColor } from '../../../providers/components/provider-brand';
import { PROVIDER_LABEL, modelLabel } from '../../utils/chat-constants';
import { readAttachment } from '../../turn';
import { AttachmentChip } from '../../../attachments/components/AttachmentChip';
import { useAttachmentThumbnail } from '../../../attachments/hooks/useAttachmentThumbnail';
import { TranscriptShell } from '../TranscriptShell';
import { CopyButton } from '@goodboy/ui';

const formatHHMM = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

type MessageAttachmentChipProps = {
  readonly attachment: MessageAttachment;
  readonly workingDir: string | null;
};

const MessageAttachmentChip = ({ attachment, workingDir }: MessageAttachmentChipProps) => {
  const thumbnail = useAttachmentThumbnail({
    kind: attachment.kind,
    relPath: attachment.relPath,
    workingDir,
  });
  const isPdf = attachment.mimeType === 'application/pdf';

  return (
    <AttachmentChip
      fileName={attachment.fileName}
      mimeType={attachment.mimeType}
      thumbnail={attachment.kind === 'image' ? thumbnail : undefined}
      preview={thumbnail.status === 'ready' ? { src: thumbnail.src } : undefined}
      lazyPreview={
        isPdf && workingDir
          ? { load: () => readAttachment(workingDir, attachment.relPath), media: 'pdf' }
          : undefined
      }
      title={attachment.fileName}
    />
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
            <MessageAttachmentChip key={a.id} attachment={a} workingDir={workingDir} />
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
            presentation="icon"
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
      title={`Sent to ${label}${model ? ` · ${modelLabel(model)}` : ''}`}
    >
      <Icon size={11} aria-hidden style={{ color: brandColor(provider) }} />
      <span>{label}</span>
    </span>
  );
};

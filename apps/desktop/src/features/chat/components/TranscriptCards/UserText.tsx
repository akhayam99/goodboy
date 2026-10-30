import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ICON_SIZE, Markdown, MetaRow, PANE_RHYTHM } from '@goodboy/ui';

import type { AgentId, MessageAttachment, SessionId, UserTurnSentVia } from '@goodboy/types';
import { readAttachment } from '../../turn';
import { AttachmentChip } from '../../../attachments/components/AttachmentChip';
import { useAttachmentThumbnail } from '../../../attachments/hooks/useAttachmentThumbnail';
import { TranscriptShell } from '../TranscriptShell';
import { CopyButton } from '@goodboy/ui';
import { formatClock } from '../../../../shared/utils/time/formatClock';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { ClampedText } from '../../../../shared/components/ClampedText';

type MessageAttachmentChipProps = {
  readonly attachment: MessageAttachment;
  readonly workingDir: string | null;
};

const MessageAttachmentChip = ({ attachment, workingDir }: MessageAttachmentChipProps) => {
  const readDir = attachment.dir ?? workingDir;
  const thumbnail = useAttachmentThumbnail({
    kind: attachment.kind,
    relPath: attachment.relPath,
    workingDir: readDir,
  });
  const isPdf = attachment.mimeType === 'application/pdf';

  return (
    <AttachmentChip
      fileName={attachment.fileName}
      mimeType={attachment.mimeType}
      thumbnail={attachment.kind === 'image' ? thumbnail : undefined}
      preview={thumbnail.status === 'ready' ? { src: thumbnail.src } : undefined}
      lazyPreview={
        isPdf && readDir
          ? { load: () => readAttachment(readDir, attachment.relPath), media: 'pdf' }
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
  sentVia?: UserTurnSentVia;
  workingDir?: string | null;
  sessionId?: SessionId | null;
  agentId?: AgentId | null;
  isBrief?: boolean;
};

const SENT_VIA_LABEL: Record<UserTurnSentVia, string> = {
  queued: 'Queued · sent after the turn',
  interrupt: 'Sent now · interrupted the turn',
};

export const UserText = ({
  text,
  at,
  attachments,
  sentVia,
  workingDir = null,
  sessionId = null,
  agentId = null,
  isBrief = false,
}: Props) => {
  const atts = attachments ?? [];
  const [isBriefOpen, setIsBriefOpen] = useState(false);
  const menu = useObjectMenuTrigger({
    target: { kind: 'message', text, sessionId, agentId },
    anchorKey: null,
  });
  const firstLine =
    text
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line !== '') ?? '';
  if (isBrief && !isBriefOpen && firstLine !== '') {
    return (
      <div className="flex min-w-0 justify-end">
        <button
          type="button"
          aria-expanded={false}
          onClick={() => setIsBriefOpen(true)}
          onContextMenu={menu.onContextMenu}
          className="flex min-w-0 max-w-full items-center gap-1 rounded-lg bg-elevated px-3 py-1 text-meta text-muted-foreground ring-1 ring-border-soft hover:text-foreground"
        >
          <span className="min-w-0 truncate">Asked: {firstLine}</span>
          <ChevronDown size={ICON_SIZE.row} aria-hidden className="shrink-0" />
        </button>
      </div>
    );
  }
  return (
    <TranscriptShell
      onContextMenu={menu.onContextMenu}
      tone="neutral"
      variant="plain"
      className={`ml-auto flex w-fit ${PANE_RHYTHM.message.user} flex-col gap-2 rounded-lg bg-elevated px-3 py-2 ring-1 ring-border-soft`}
    >
      {atts.length > 0 && (
        <div className="flex flex-wrap justify-end gap-2">
          {atts.map((a) => (
            <MessageAttachmentChip key={a.id} attachment={a} workingDir={workingDir} />
          ))}
        </div>
      )}
      {text.length > 0 && (
        <ClampedText text={text} className="text-prose text-foreground">
          <Markdown text={text} />
        </ClampedText>
      )}
      <div className="flex items-center justify-end gap-2">
        <MetaRow
          items={[
            sentVia ? <span key="sent-via">{SENT_VIA_LABEL[sentVia]}</span> : null,
            <span key="time" className="tabular-nums">
              {formatClock({ at })}
            </span>,
          ]}
        />
        {text.length > 0 && (
          <CopyButton
            presentation="icon"
            value={text}
            label="copy message"
            className="rounded-md p-0.5 text-muted-foreground transition-opacity hover:opacity-80 hover:text-foreground"
          />
        )}
      </div>
    </TranscriptShell>
  );
};

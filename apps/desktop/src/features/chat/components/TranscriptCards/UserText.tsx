import { Markdown, MetaRow, PANE_RHYTHM } from '@goodboy/ui';

import type { AgentId, MessageAttachment, SessionId, UserTurnSentVia } from '@goodboy/types';
import { AttachmentStrip } from '../../../attachments/AttachmentStrip';
import { TranscriptShell } from '../TranscriptShell';
import { CopyButton } from '@goodboy/ui';
import { formatClock } from '../../../../shared/utils/time/formatClock';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { ClampedText } from '../../../../shared/components/ClampedText';

type Props = {
  text: string;
  at: string;
  attachments?: ReadonlyArray<MessageAttachment>;
  sentVia?: UserTurnSentVia;
  workingDir?: string | null;
  sessionId?: SessionId | null;
  agentId?: AgentId | null;
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
}: Props) => {
  const atts = attachments ?? [];
  const menu = useObjectMenuTrigger({
    target: { kind: 'message', text, sessionId, agentId },
    anchorKey: null,
  });
  return (
    <TranscriptShell
      onContextMenu={menu.onContextMenu}
      tone="neutral"
      variant="plain"
      className={`ml-auto flex w-fit ${PANE_RHYTHM.message.user} flex-col gap-2 rounded-lg bg-elevated px-3 py-2 ring-1 ring-border-soft`}
    >
      {atts.length > 0 && (
        <AttachmentStrip
          isEnd
          railLabel="Images in this message"
          items={atts.map((a) => ({
            id: a.id,
            fileName: a.fileName,
            mimeType: a.mimeType,
            kind: a.kind,
            relPath: a.relPath,
            workingDir: a.dir ?? workingDir,
          }))}
        />
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

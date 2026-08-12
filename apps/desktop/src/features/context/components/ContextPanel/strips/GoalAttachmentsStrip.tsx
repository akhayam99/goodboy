import { useEffect } from 'react';
import { Paperclip } from 'lucide-react';
import { Eyebrow } from '@goodboy/ui';
import type { GoalAttachment, GoalAttachmentOwner, SessionId, WorkflowRunId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { AttachmentChip } from '../../../../attachments/components/AttachmentChip';
import { useAttachmentThumbnail } from '../../../../attachments/hooks/useAttachmentThumbnail';
import { ATTACHMENT_KIND_ROUTING } from '../../../../providers/attachment-routing';

export function GoalAttachmentsStrip({ owner }: { readonly owner: GoalAttachmentOwner }) {
  const loadGoalAttachments = useAppStore((s) => s.loadGoalAttachments);
  const removeGoalAttachment = useAppStore((s) => s.removeGoalAttachment);
  const attachments = useAppStore((s) =>
    owner.type === 'session'
      ? (s.sessionAttachments[owner.id as SessionId] ?? EMPTY_ARRAY)
      : (s.workflowRunAttachments[owner.id as WorkflowRunId] ?? EMPTY_ARRAY),
  );
  const workingDir = useAppStore((s) => {
    const sessionId = owner.type === 'session' ? (owner.id as SessionId) : s.currentSessionId;
    return sessionId ? ((s.sessionWorktrees[sessionId] ?? EMPTY_ARRAY)[0] ?? null) : null;
  });

  const ownerType = owner.type;
  const ownerId = owner.id;
  useEffect(() => {
    void loadGoalAttachments({ type: ownerType, id: ownerId });
  }, [ownerType, ownerId, loadGoalAttachments]);

  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <Eyebrow
        muted
        icon={<Paperclip size={11} aria-hidden />}
        label="Attachments"
        className="gap-1.5 font-medium"
      />
      <div className="flex flex-wrap gap-2">
        {attachments.map((att) => (
          <GoalAttachmentChip
            key={att.id}
            attachment={att}
            workingDir={workingDir}
            onRemove={() => void removeGoalAttachment(owner, att.id)}
          />
        ))}
      </div>
    </div>
  );
}

const GoalAttachmentChip = ({
  attachment,
  workingDir,
  onRemove,
}: {
  readonly attachment: GoalAttachment;
  readonly workingDir: string | null;
  readonly onRemove: () => void;
}) => {
  const thumbnail = useAttachmentThumbnail({
    kind: attachment.kind,
    relPath: attachment.relPath,
    workingDir,
  });
  const readers = ATTACHMENT_KIND_ROUTING[attachment.kind].join(', ');

  return (
    <AttachmentChip
      fileName={attachment.fileName}
      mimeType={attachment.mimeType}
      thumbnail={attachment.kind === 'image' ? thumbnail : undefined}
      preview={thumbnail.status === 'ready' ? { src: thumbnail.src } : undefined}
      title={`${attachment.fileName}\nread by: ${readers}`}
      onRemove={onRemove}
    />
  );
};

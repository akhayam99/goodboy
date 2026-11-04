import { useEffect } from 'react';
import { Paperclip } from 'lucide-react';
import { Eyebrow, ICON_SIZE } from '@goodboy/ui';
import {
  brandId,
  type GoalAttachmentOwner,
  type SessionId,
  type WorkflowRunId,
} from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { attachmentDirOf } from '../../../../../store/slices/attachments/attachmentDirOf';
import { AttachmentStrip, type AttachmentStripItem } from '../../../../attachments/AttachmentStrip';
import { ATTACHMENT_KIND_ROUTING } from '../../../../providers/attachment-routing';

export const GoalAttachmentsStrip = ({ owner }: { readonly owner: GoalAttachmentOwner }) => {
  const loadGoalAttachments = useAppStore((s) => s.loadGoalAttachments);
  const removeGoalAttachment = useAppStore((s) => s.removeGoalAttachment);
  const attachments = useAppStore((s) =>
    owner.type === 'session'
      ? (s.sessionAttachments[owner.id as SessionId] ?? EMPTY_ARRAY)
      : (s.workflowRunAttachments[owner.id as WorkflowRunId] ?? EMPTY_ARRAY),
  );
  const worktreeDir = useAppStore((s) => {
    const sessionId = owner.type === 'session' ? (owner.id as SessionId) : s.currentSessionId;
    return sessionId ? ((s.sessionWorktrees[sessionId] ?? EMPTY_ARRAY)[0] ?? null) : null;
  });
  const scratchDir = useAppStore((s) => {
    const sessionId =
      owner.type === 'session' ? brandId<SessionId>({ value: owner.id }) : s.currentSessionId;
    return sessionId ? (s.sessionScratchDirs[sessionId] ?? null) : null;
  });

  const ownerType = owner.type;
  const isReadOnly = ownerType === 'workflow_run';
  const ownerId = owner.id;
  useEffect(() => {
    void loadGoalAttachments({ type: ownerType, id: ownerId });
  }, [ownerType, ownerId, loadGoalAttachments]);

  if (attachments.length === 0) {
    return null;
  }

  const items: ReadonlyArray<AttachmentStripItem> = attachments.map((att) => ({
    id: att.id,
    fileName: att.fileName,
    mimeType: att.mimeType,
    kind: att.kind,
    relPath: att.relPath,
    workingDir: attachmentDirOf({ relPath: att.relPath, worktreeDir, scratchDir }),
    title: `${att.fileName}\nread by: ${ATTACHMENT_KIND_ROUTING[att.kind].join(', ')}`,
    ...(isReadOnly ? {} : { onRemove: () => void removeGoalAttachment(owner, att.id) }),
  }));

  return (
    <div className="flex flex-col gap-2">
      <Eyebrow
        muted
        icon={<Paperclip size={ICON_SIZE.row} aria-hidden />}
        label="Attachments"
        className="gap-2 font-medium"
      />
      <AttachmentStrip items={items} railLabel="Images in this goal" />
    </div>
  );
};

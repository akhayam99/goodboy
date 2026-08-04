import { useEffect, useState } from 'react';
import { ImageOff, Paperclip, X } from 'lucide-react';
import { Eyebrow, Skeleton } from '@goodboy/ui';
import type { GoalAttachment, GoalAttachmentOwner, SessionId, WorkflowRunId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { fileIconFor } from '../../../../chat/attachment-kinds';
import { readAttachment } from '../../../../chat/turn';
import { ImageLightbox } from '../../../../chat/components/ImageLightbox';
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
          <AttachmentChip
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

function AttachmentChip({
  attachment,
  workingDir,
  onRemove,
}: {
  readonly attachment: GoalAttachment;
  readonly workingDir: string | null;
  readonly onRemove: () => void;
}) {
  const readers = ATTACHMENT_KIND_ROUTING[attachment.kind].join(', ');
  const title = `${attachment.fileName}\nread by: ${readers}`;
  const removeButton = (
    <button
      type="button"
      onClick={onRemove}
      title={`Remove ${attachment.fileName}`}
      aria-label={`Remove ${attachment.fileName}`}
      className="absolute right-0.5 top-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-foreground/70 text-background opacity-0 transition-opacity hover:bg-foreground group-hover:opacity-100"
    >
      <X size={10} aria-hidden />
    </button>
  );

  if (attachment.kind === 'image') {
    return (
      <div
        className="group relative h-16 w-16 overflow-hidden rounded-md ring-1 ring-border-soft"
        title={title}
      >
        <ImageThumb attachment={attachment} workingDir={workingDir} />
        {removeButton}
      </div>
    );
  }

  const Icon = fileIconFor(attachment.mimeType);
  return (
    <div
      className="group relative flex h-16 max-w-[12rem] items-center gap-2 rounded-md bg-background/60 py-2 pl-2.5 pr-6 ring-1 ring-border-soft"
      title={title}
    >
      <Icon size={18} aria-hidden className="shrink-0 text-muted-foreground" />
      <span className="truncate text-xs text-foreground/80">{attachment.fileName}</span>
      {removeButton}
    </div>
  );
}

function ImageThumb({
  attachment,
  workingDir,
}: {
  readonly attachment: GoalAttachment;
  readonly workingDir: string | null;
}) {
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
        if (alive) setSrc(dataUrl);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [workingDir, attachment.relPath]);

  if (failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-foreground/5 text-muted-foreground">
        <ImageOff size={14} aria-hidden />
      </div>
    );
  }

  if (src === null) {
    return <Skeleton className="h-full w-full rounded-none" />;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setPreviewOpen(true)}
        title={`Preview ${attachment.fileName}`}
        aria-label={`Preview ${attachment.fileName}`}
        className="block h-full w-full cursor-zoom-in"
      >
        <img src={src} alt={attachment.fileName} className="h-full w-full object-cover" />
      </button>
      {previewOpen ? (
        <ImageLightbox src={src} alt={attachment.fileName} onClose={() => setPreviewOpen(false)} />
      ) : null}
    </>
  );
}

import type { ChangeEvent, RefObject } from 'react';
import { Paperclip } from 'lucide-react';
import { SectionHeader, cn, tintClasses } from '@goodboy/ui';
import { ATTACHMENT_ACCEPT } from '../../../chat/attachment-kinds';
import type { ArtifactAttachment } from '../../artifactAttachments';
import { ArtifactAttachmentChip } from './ArtifactAttachmentChip';

type Props = {
  readonly attachments: ReadonlyArray<ArtifactAttachment>;
  readonly worktree: string | null;
  readonly isDragging: boolean;
  readonly note: string | null;
  readonly composerRef: RefObject<HTMLDivElement | null>;
  readonly fileInputRef: RefObject<HTMLInputElement | null>;
  readonly onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onRemove: (params: { readonly id: string }) => void;
};

const EMPTY_HINT = 'Drop or add files. Their paths go in the pack for the agent to read.';

const NO_WORKTREE_HINT = 'This session has no worktree yet, so nothing can be attached.';

export const ArtifactAttachmentsField = ({
  attachments,
  worktree,
  isDragging,
  note,
  composerRef,
  fileInputRef,
  onFileInputChange,
  onRemove,
}: Props) => (
  <section className="flex min-w-0 flex-col gap-2">
    <SectionHeader label="Attachments" />
    <div
      ref={composerRef}
      data-drop-composer
      data-testid="artifact-attachments"
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors',
        isDragging
          ? cn('border-dashed border-primary', tintClasses('primary').bgSoft)
          : 'border-border-soft',
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ATTACHMENT_ACCEPT}
        multiple
        hidden
        data-testid="artifact-attachments-input"
        onChange={onFileInputChange}
      />
      <button
        type="button"
        disabled={worktree === null}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2 py-0.5 text-2xs transition-colors',
          worktree === null
            ? 'cursor-not-allowed text-muted-foreground'
            : 'text-muted-foreground hover:bg-hover hover:text-foreground',
        )}
      >
        <Paperclip size={11} aria-hidden /> Add files
      </button>
      {attachments.length > 0 ? (
        attachments.map((attachment) => (
          <ArtifactAttachmentChip
            key={attachment.id}
            attachment={attachment}
            worktree={worktree}
            onRemove={() => onRemove({ id: attachment.id })}
            onMissing={() => onRemove({ id: attachment.id })}
          />
        ))
      ) : (
        <span className="text-2xs text-faint-foreground">
          {worktree === null ? NO_WORKTREE_HINT : EMPTY_HINT}
        </span>
      )}
    </div>
    {note === null ? null : (
      <span role="status" className="text-2xs text-muted-foreground">
        {note}
      </span>
    )}
  </section>
);

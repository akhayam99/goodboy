import { useState } from 'react';
import { Bot, Lock, Trash2 } from 'lucide-react';
import { Avatar, Chip, InlineConfirm, Markdown, cn, tintClasses } from '@goodboy/ui';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { DiffComments, DiffThread } from './types';
import { THREAD_ACTION_CLASS as ACTION_CLASS } from './threadActionClass';
import { ThreadActionButton } from './ThreadActionButton';
import { CommentComposer } from './CommentComposer';
import { useNow } from '../../../../shared/hooks/useNow';

type Props = {
  readonly thread: DiffThread;
  readonly comments: DiffComments;
};

const CLOSE_NOTE_LABEL = 'Close note';

const excerpt = (body: string): string => {
  const line = body.split('\n')[0] ?? '';
  return line.length > 60 ? `${line.slice(0, 57)}...` : line;
};

export const CommentThread = ({ thread, comments }: Props) => {
  const now = useNow(30_000);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const tint = tintClasses(thread.tone);
  const lockReason = thread.lockReason ?? null;
  const isLocked = lockReason !== null;

  if (thread.isResolved) {
    return (
      <div
        data-slot="diff-thread"
        data-thread-state="resolved"
        className="flex min-w-0 items-center gap-1.5 rounded-md bg-subtle px-3 py-1.5 font-sans text-secondary text-muted-foreground"
      >
        <span className="shrink-0 font-medium">{thread.statusLabel}</span>
        <span aria-hidden>·</span>
        <span className="min-w-0 truncate">&ldquo;{excerpt(thread.body)}&rdquo;</span>
        {(thread.actions ?? []).map((action) => (
          <span key={action.id} className="flex shrink-0 items-center gap-1.5">
            <span aria-hidden>·</span>
            <ThreadActionButton action={action} />
          </span>
        ))}
        {thread.canReopen && comments.onReopen ? (
          <>
            <span aria-hidden>·</span>
            <button
              type="button"
              className={ACTION_CLASS}
              onClick={() => comments.onReopen?.(thread.id)}
            >
              Reopen
            </button>
          </>
        ) : null}
      </div>
    );
  }

  if (editing && comments.onEdit) {
    return (
      <CommentComposer
        label="Edit comment"
        submitLabel="Save"
        initialBody={thread.body}
        onSubmit={(body) => {
          comments.onEdit?.(thread.id, body);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div
      data-slot="diff-thread"
      data-thread-state="open"
      className={cn(
        'flex min-w-0 flex-col gap-1.5 rounded-md border-l-2 bg-elevated px-3 py-2 font-sans',
        tint.rail,
      )}
    >
      <div className="flex min-w-0 items-center gap-2 text-secondary text-muted-foreground">
        {thread.isAgent ? (
          <span
            aria-hidden
            className="flex size-5 shrink-0 items-center justify-center rounded-full bg-subtle"
          >
            <Bot size={ICON_SIZE.row} className="text-muted-foreground" />
          </span>
        ) : (
          <Avatar url={null} alt={thread.author} size="xs" />
        )}
        <span className="font-medium text-foreground">{thread.author}</span>
        <span>· {formatAge({ from: thread.createdAt, now })}</span>
        <Chip tone={thread.tone} size="3xs" bordered={false} label={thread.statusLabel} />
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {(thread.actions ?? []).map((action) => (
            <ThreadActionButton key={action.id} action={action} />
          ))}
          {thread.canEdit && comments.onEdit ? (
            <button type="button" className={ACTION_CLASS} onClick={() => setEditing(true)}>
              Edit
            </button>
          ) : null}
          {thread.canClose && comments.onClose ? (
            <button
              type="button"
              className={ACTION_CLASS}
              disabled={isLocked}
              title={lockReason ?? undefined}
              onClick={() => comments.onClose?.(thread.id)}
            >
              {CLOSE_NOTE_LABEL}
            </button>
          ) : null}
          {thread.canReopen && comments.onReopen ? (
            <button
              type="button"
              className={ACTION_CLASS}
              onClick={() => comments.onReopen?.(thread.id)}
            >
              Reopen
            </button>
          ) : null}
          {thread.canDelete !== false && comments.onDelete ? (
            <button
              type="button"
              className={ACTION_CLASS}
              disabled={isLocked}
              title={lockReason ?? undefined}
              onClick={() => setConfirmingDelete(true)}
            >
              Delete
            </button>
          ) : null}
        </span>
      </div>
      <div className="min-w-0 text-body text-foreground">
        <Markdown text={thread.body} variant="preview" />
      </div>
      {isLocked || (thread.meta ?? null) !== null ? (
        <div className="flex min-w-0 items-center gap-1.5 text-secondary text-faint-foreground">
          {isLocked ? (
            <>
              <Lock size={ICON_SIZE.row} aria-hidden className="shrink-0" />
              <span className="shrink-0">{lockReason}</span>
            </>
          ) : null}
          {isLocked && (thread.meta ?? null) !== null ? <span aria-hidden>·</span> : null}
          {(thread.meta ?? null) !== null ? (
            <span className="min-w-0 truncate">{thread.meta}</span>
          ) : null}
        </div>
      ) : null}
      {thread.footer ?? null}
      {confirmingDelete ? (
        <InlineConfirm
          role="danger"
          icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
          title="Delete this comment?"
          confirmLabel="Delete"
          onConfirm={() => {
            comments.onDelete?.(thread.id);
            setConfirmingDelete(false);
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      ) : null}
    </div>
  );
};

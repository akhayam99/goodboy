import { useState } from 'react';
import { Bot, Trash2 } from 'lucide-react';
import { Avatar, Chip, InlineConfirm, Markdown, cn, tintClasses } from '@goodboy/ui';
import { formatRelativeAge } from '../../../../shared/utils/relativeDate';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { DiffComments, DiffThread } from './types';
import { CommentComposer } from './CommentComposer';

type Props = {
  readonly thread: DiffThread;
  readonly comments: DiffComments;
};

const ACTION_CLASS =
  'rounded-sm px-1 text-secondary text-muted-foreground transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

const excerpt = (body: string): string => {
  const line = body.split('\n')[0] ?? '';
  return line.length > 60 ? `${line.slice(0, 57)}...` : line;
};

export const CommentThread = ({ thread, comments }: Props) => {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const tint = tintClasses(thread.tone);

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
        <span>· {formatRelativeAge({ fromIso: thread.createdAt })}</span>
        <Chip tone={thread.tone} size="3xs" bordered={false} label={thread.statusLabel} />
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {thread.canEdit && comments.onEdit ? (
            <button type="button" className={ACTION_CLASS} onClick={() => setEditing(true)}>
              Edit
            </button>
          ) : null}
          {thread.canResolve && comments.onResolve ? (
            <button
              type="button"
              className={ACTION_CLASS}
              onClick={() => comments.onResolve?.(thread.id)}
            >
              Resolve
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
          {comments.onDelete ? (
            <button
              type="button"
              className={ACTION_CLASS}
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

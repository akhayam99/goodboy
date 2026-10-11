import { useState, type ReactNode } from 'react';
import { Lock, Trash2 } from 'lucide-react';
import { Chip, ConfirmPopover, Markdown, cn, tintClasses } from '@goodboy/ui';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { DiffComments, DiffThread } from './types';
import { THREAD_ACTION_CLASS as ACTION_CLASS } from './threadActionClass';
import { ThreadActionButton } from './ThreadActionButton';
import { CommentComposer } from './CommentComposer';
import { ThreadReplies, repliesLabel } from './ThreadReplies';
import { ThreadKindChip } from './ThreadKindChip';
import { ThreadWho } from './ThreadWho';
import { kindLabelOf } from './threadKind';
import { useHostThreadVerbs } from '../../hooks/useHostThreadVerbs';
import { useNow } from '../../../../shared/hooks/useNow';

type Props = {
  readonly thread: DiffThread;
  readonly comments: DiffComments;
  readonly outcome?: ReactNode;
};

type DeleteButtonParams = {
  readonly onClick: () => void;
};

const CLOSE_NOTE_LABEL = 'Close note';

const excerpt = (body: string): string => {
  const line = body.split('\n')[0] ?? '';
  return line.length > 60 ? `${line.slice(0, 57)}...` : line;
};

export const CommentThread = ({ thread, comments, outcome = null }: Props) => {
  const now = useNow(30_000);
  const [editing, setEditing] = useState(false);
  const tint = tintClasses(thread.tone);
  const noun = comments.noun ?? 'comment';
  const lockReason = thread.lockReason ?? null;
  const isLocked = lockReason !== null;
  const replyCount = thread.replies?.length ?? 0;
  const verbs = useHostThreadVerbs({ thread, comments });

  if (thread.isResolved) {
    return (
      <article
        aria-label={`${kindLabelOf({ thread })} from ${thread.author}, ${thread.statusLabel.toLowerCase()}`}
        data-slot="diff-thread"
        data-thread-id={thread.id}
        tabIndex={-1}
        data-thread-state="resolved"
        data-thread-source={thread.source}
        className="flex min-w-0 items-center gap-1 rounded-md bg-subtle px-3 py-1 font-sans text-chip text-muted-foreground"
      >
        <ThreadKindChip thread={thread} />
        <span className="shrink-0 font-medium">{thread.statusLabel}</span>
        <span aria-hidden>·</span>
        <span className="min-w-0 truncate">&ldquo;{excerpt(thread.body)}&rdquo;</span>
        {(thread.actions ?? []).map((action) => (
          <span key={action.id} className="flex shrink-0 items-center gap-2">
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
      </article>
    );
  }

  if (editing && comments.onEdit) {
    return (
      <CommentComposer
        label={`Edit ${noun}`}
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

  const deleteButton = ({ onClick }: DeleteButtonParams) => (
    <button
      type="button"
      className={ACTION_CLASS}
      disabled={isLocked}
      title={lockReason ?? undefined}
      onClick={onClick}
    >
      Delete
    </button>
  );
  const deleteControl =
    thread.canRestore === true ? (
      deleteButton({ onClick: () => comments.onDelete?.(thread.id) })
    ) : (
      <ConfirmPopover
        role="danger"
        icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
        title={`Delete this ${noun}?`}
        description="It is removed from the review."
        confirmLabel={`Delete ${noun}`}
        onConfirm={() => comments.onDelete?.(thread.id)}
        trigger={({ arm }) => deleteButton({ onClick: arm })}
      />
    );

  return (
    <article
      aria-label={`${kindLabelOf({ thread })} from ${thread.author}`}
      data-slot="diff-thread"
      data-thread-id={thread.id}
      tabIndex={-1}
      data-thread-state="open"
      data-thread-source={thread.source}
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-md border-l-2 bg-elevated px-3 py-2 font-sans',
        tint.rail,
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-meta text-muted-foreground">
        <ThreadWho thread={thread} />
        <ThreadKindChip thread={thread} />
        {outcome}
        <Chip tone={thread.tone} kind="state" bordered={false} label={thread.statusLabel} />
        <span>{formatAge({ from: thread.createdAt, now })}</span>
        {replyCount > 0 ? <span>{repliesLabel({ count: replyCount })}</span> : null}
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {(thread.actions ?? []).map((action) => (
            <ThreadActionButton key={action.id} action={action} />
          ))}
          {verbs.canReply ? (
            <button
              type="button"
              className={ACTION_CLASS}
              aria-expanded={verbs.isReplying}
              onClick={verbs.openReply}
            >
              Reply
            </button>
          ) : null}
          {verbs.canResolve ? (
            <button
              type="button"
              className={ACTION_CLASS}
              disabled={verbs.isBusy}
              onClick={verbs.resolve}
            >
              Resolve
            </button>
          ) : null}
          {verbs.canOpenInComments ? (
            <button type="button" className={ACTION_CLASS} onClick={verbs.openInComments}>
              Open in Comments
            </button>
          ) : null}
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
          {thread.canDelete !== false && comments.onDelete ? deleteControl : null}
        </span>
      </div>
      <div className="min-w-0 text-body text-foreground">
        <Markdown text={thread.body} variant="preview" />
      </div>
      {replyCount > 0 ? <ThreadReplies replies={thread.replies ?? []} /> : null}
      {verbs.isReplying ? (
        <CommentComposer
          label={`Reply to ${thread.author}`}
          submitLabel="Reply"
          isBusy={verbs.isBusy}
          error={verbs.error}
          onSubmit={verbs.sendReply}
          onCancel={verbs.cancelReply}
        />
      ) : null}
      {!verbs.isReplying && verbs.error !== null ? (
        <p role="alert" className="text-meta text-danger">
          {verbs.error}
        </p>
      ) : null}
      {isLocked || (thread.meta ?? null) !== null ? (
        <div className="flex min-w-0 items-center gap-1 text-meta text-faint-foreground">
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
    </article>
  );
};

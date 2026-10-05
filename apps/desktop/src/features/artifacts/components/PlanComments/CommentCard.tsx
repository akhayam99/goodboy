import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { Chip, IconButton, cn, tintClasses } from '@goodboy/ui';
import type { ArtifactComment } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { CommentComposer } from './CommentComposer';

type Props = {
  readonly comment: ArtifactComment;
  readonly revision: number;
  readonly onEdit: (params: { readonly commentId: string; readonly body: string }) => Promise<void>;
  readonly onRemove: (params: { readonly commentId: string }) => Promise<void>;
};

const tagOf = ({
  comment,
  revision,
}: {
  readonly comment: ArtifactComment;
  readonly revision: number;
}) => {
  if (comment.status === 'draft') {
    return <Chip tone="neutral" size="3xs" label="Draft" />;
  }
  if (comment.status === 'sent') {
    return <Chip tone="info" size="3xs" label="Sent" />;
  }
  if (comment.status === 'addressed') {
    return (
      <Chip
        tone="success"
        size="3xs"
        icon={<Check size={ICON_SIZE.row} aria-hidden />}
        label="Addressed"
      />
    );
  }
  return (
    <Chip
      tone="neutral"
      size="3xs"
      label={
        comment.revision < revision ? `Not changed in v${revision}` : 'No new version in this turn'
      }
    />
  );
};

export const CommentCard = ({ comment, revision, onEdit, onRemove }: Props) => {
  const [isEditing, setIsEditing] = useState(false);
  const { anchor } = comment;
  const quote = anchor.kind === 'quote' ? anchor.text : null;

  return (
    <div
      data-testid="plan-comment"
      data-status={comment.status}
      className="flex min-w-0 flex-col gap-1 rounded-md border border-border-soft bg-background px-3 py-2"
    >
      <div className="flex min-h-6 items-center gap-2">
        <span
          aria-hidden
          className={cn('size-3.5 shrink-0 rounded-full', tintClasses('primary').dot)}
        />
        <span className="text-meta text-foreground">You</span>
        {tagOf({ comment, revision })}
        <span className="flex-1" />
        {comment.status === 'draft' && !isEditing ? (
          <>
            <IconButton
              label="Edit comment"
              icon={Pencil}
              iconSize={ICON_SIZE.row}
              variant="ghost"
              onClick={() => setIsEditing(true)}
            />
            <IconButton
              label="Remove comment"
              icon={X}
              iconSize={ICON_SIZE.row}
              variant="ghost"
              onClick={() => void onRemove({ commentId: comment.id })}
            />
          </>
        ) : null}
      </div>
      {isEditing ? (
        <CommentComposer
          quote={quote}
          initialBody={comment.body}
          submitLabel="Save"
          onSubmit={async ({ body }) => {
            await onEdit({ commentId: comment.id, body });
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <>
          {quote === null ? null : (
            <q className="block text-meta italic text-muted-foreground">{quote}</q>
          )}
          <p className="whitespace-pre-wrap text-body text-foreground wrap-anywhere">
            {comment.body}
          </p>
        </>
      )}
    </div>
  );
};

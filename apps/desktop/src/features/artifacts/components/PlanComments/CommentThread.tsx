import type { ArtifactComment } from '@goodboy/types';
import { quoteOf } from '../../../plans/planComments/planCommentAnchors';
import { usePlanCommentsApi } from '../../../plans/planComments/usePlanCommentsApi';
import { CommentCard } from './CommentCard';
import { CommentComposer } from './CommentComposer';

type Props = {
  readonly comments: ReadonlyArray<ArtifactComment>;
  readonly isComposing: boolean;
  readonly label?: string;
};

export const CommentThread = ({ comments, isComposing, label }: Props) => {
  const api = usePlanCommentsApi();
  if (api === null || (comments.length === 0 && !isComposing)) {
    return null;
  }
  const composing = isComposing ? api.composing : null;
  return (
    <div data-testid="plan-comment-thread" className="flex min-w-0 flex-col gap-2">
      {label === undefined ? null : (
        <span className="text-meta text-faint-foreground">{label}</span>
      )}
      {comments.map((comment) => (
        <CommentCard
          key={comment.id}
          comment={comment}
          revision={api.revision}
          onEdit={api.edit}
          onRemove={api.remove}
        />
      ))}
      {composing === null ? null : (
        <CommentComposer
          quote={composing.anchor.kind === 'quote' ? quoteOf({ anchor: composing.anchor }) : null}
          onSubmit={api.add}
          onCancel={api.cancelComposing}
        />
      )}
    </div>
  );
};

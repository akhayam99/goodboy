import type { ReactNode } from 'react';
import { commentsForPart } from '../../../plans/planComments/planCommentAnchors';
import { usePlanCommentsApi } from '../../../plans/planComments/usePlanCommentsApi';
import { CommentButton } from './CommentButton';
import { CommentThread } from './CommentThread';

type Props = {
  readonly index: number;
  readonly title: string;
  readonly children: ReactNode;
};

export const PartCommentFrame = ({ index, title, children }: Props) => {
  const api = usePlanCommentsApi();
  if (api === null) {
    return children;
  }
  const comments = commentsForPart({ comments: api.comments, index });
  const { composing } = api;
  const isComposing =
    composing !== null && composing.anchor.kind === 'part' && composing.anchor.index === index;

  return (
    <div data-testid="plan-part-comments" className="group/part flex min-w-0 flex-col gap-2">
      <div className="relative min-w-0">
        {children}
        {api.canComment ? (
          <CommentButton
            label={`Comment on part ${index + 1}`}
            onClick={() => api.startComposing({ anchor: { kind: 'part', index, title } })}
            className="absolute right-2 top-1 opacity-0 group-focus-within/part:opacity-100 group-hover/part:opacity-100 focus-visible:opacity-100"
          />
        ) : null}
      </div>
      {comments.length === 0 && !isComposing ? null : (
        <div className="pl-9">
          <CommentThread comments={comments} isComposing={isComposing} />
        </div>
      )}
    </div>
  );
};

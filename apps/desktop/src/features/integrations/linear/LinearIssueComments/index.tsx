import { EmptyState, Markdown, Skeleton } from '@goodboy/ui';
import { formatRelativeDuration } from '../../../../shared/utils/relativeDate';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import type { LinearIssueComment } from '../client';

type Props = {
  readonly comments: ReadonlyArray<LinearIssueComment>;
  readonly isLoading: boolean;
  readonly error: string | null;
};

export const LinearIssueComments = ({ comments, isLoading, error }: Props) => {
  if (isLoading) {
    return (
      <div role="status" aria-label="Loading comments" className="flex flex-col gap-4">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex flex-col gap-2 rounded-lg bg-muted/20 p-3">
            <Skeleton className="h-3 w-28 rounded" />
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-2/3 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error != null) {
    return <p className="text-sm text-danger">{error}</p>;
  }

  if (comments.length === 0) {
    return (
      <EmptyState
        icon={CONCEPT_ICONS.comments}
        tone={CONCEPT_TONE.comments}
        title="No comments"
        description="This issue has no comments yet."
        size="inline"
        className="py-5"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {comments.map((comment) => {
        const relativeDate = formatRelativeDuration(comment.createdAt);
        return (
          <div key={comment.id} className="flex flex-col gap-2 rounded-lg bg-muted/20 p-3">
            <div className="flex items-center gap-2 text-2xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {comment.user?.name ?? 'Unknown author'}
              </span>
              {relativeDate !== '' ? <span>{relativeDate} ago</span> : null}
            </div>
            <Markdown text={comment.body} className="text-sm leading-relaxed" />
          </div>
        );
      })}
    </div>
  );
};

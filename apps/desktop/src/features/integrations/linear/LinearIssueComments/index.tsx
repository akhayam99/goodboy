import { EmptyState, Markdown, Skeleton } from '@goodboy/ui';
import { MessageSquare } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { formatRelativeDuration } from '../../../../shared/utils/relativeDate';
import { useLinearIssueComments } from '../useLinearIssueComments';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly issueId: string;
};

export const LinearIssueComments = ({ workspaceId, issueId }: Props) => {
  const { comments, isLoading, error } = useLinearIssueComments({ workspaceId, issueId });

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
        icon={MessageSquare}
        title="No comments"
        description="This issue has no comments yet."
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

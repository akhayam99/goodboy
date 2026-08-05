import { EmptyState, Markdown, Skeleton } from '@goodboy/ui';
import type { GithubIssueComment } from '@goodboy/types';
import { formatRelativeDuration } from '../../../shared/utils/relativeDate';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import { Avatar } from '../components/Avatar';
import { GithubIssueCommentComposer } from './GithubIssueCommentComposer';

type Props = {
  readonly comments: ReadonlyArray<GithubIssueComment>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly onPost: ((body: string) => Promise<void>) | null;
};

export const GithubIssueComments = ({ comments, isLoading, error, onPost }: Props) => {
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

  return (
    <div className="flex flex-col gap-4">
      {error != null && <p className="text-sm text-danger">{error}</p>}
      {error == null && comments.length === 0 && (
        <EmptyState
          icon={CONCEPT_ICONS.comments}
          tone={CONCEPT_TONE.comments}
          title="No comments"
          description="This issue has no comments yet."
          size="inline"
          className="py-5"
        />
      )}
      {comments.length > 0 && (
        <div className="flex flex-col gap-3">
          {comments.map((comment) => {
            const relativeDate = formatRelativeDuration(comment.createdAt);
            return (
              <div key={comment.id} className="flex flex-col gap-2 rounded-lg bg-muted/20 p-3">
                <div className="flex items-center gap-2 text-2xs text-muted-foreground">
                  <Avatar url={comment.authorAvatarUrl} alt={comment.author} />
                  <span className="font-medium text-foreground">{comment.author}</span>
                  {relativeDate !== '' && <span>{relativeDate} ago</span>}
                </div>
                <Markdown text={comment.body} className="text-sm leading-relaxed" />
              </div>
            );
          })}
        </div>
      )}
      {onPost != null && <GithubIssueCommentComposer onPost={onPost} />}
    </div>
  );
};

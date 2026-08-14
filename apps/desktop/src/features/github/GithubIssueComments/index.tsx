import { EmptyState } from '@goodboy/ui';
import type { GithubIssueComment } from '@goodboy/types';
import { formatRelativeDuration } from '../../../shared/utils/relativeDate';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import { Avatar } from '@goodboy/ui';
import { NoteCard } from '@goodboy/ui';
import { NoteComposer } from '../../../shared/components/NoteComposer';
import { NoteHeader } from '@goodboy/ui';
import { NoteListSkeleton } from '@goodboy/ui';

type Props = {
  readonly comments: ReadonlyArray<GithubIssueComment>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly onPost: ((body: string) => Promise<void>) | null;
};

export const GithubIssueComments = ({ comments, isLoading, error, onPost }: Props) => {
  if (isLoading) {
    return <NoteListSkeleton label="Loading comments" />;
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
              <NoteCard
                key={comment.id}
                header={
                  <NoteHeader
                    avatar={<Avatar url={comment.authorAvatarUrl} alt={comment.author} size="xs" />}
                    author={comment.author}
                    timestamp={relativeDate !== '' ? <span>{relativeDate} ago</span> : null}
                    size="xs"
                  />
                }
                body={comment.body}
              />
            );
          })}
        </div>
      )}
      {onPost != null && (
        <NoteComposer placeholder="Write a comment" submitLabel="Comment" onSubmit={onPost} />
      )}
    </div>
  );
};

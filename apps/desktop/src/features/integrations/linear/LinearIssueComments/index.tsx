import { EmptyState, NoteComposer } from '@goodboy/ui';
import { formatRelativeDuration } from '../../../../shared/utils/relativeDate';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { NoteCard } from '@goodboy/ui';
import { NoteHeader } from '@goodboy/ui';
import { NoteListSkeleton } from '@goodboy/ui';
import type { LinearIssueComment } from '../client';

type Props = {
  readonly comments: ReadonlyArray<LinearIssueComment>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly onPost: ((body: string) => Promise<void>) | null;
};

export const LinearIssueComments = ({ comments, isLoading, error, onPost }: Props) => {
  if (isLoading) {
    return <NoteListSkeleton label="Loading comments" />;
  }

  if (error != null) {
    return <p className="text-sm text-danger">{error}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {comments.length === 0 ? (
        <EmptyState
          icon={CONCEPT_ICONS.comments}
          tone={CONCEPT_TONE.comments}
          title="No comments"
          description="This issue has no comments yet."
          size="inline"
          className="py-5"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {comments.map((comment) => {
            const relativeDate = formatRelativeDuration(comment.createdAt);
            return (
              <NoteCard
                key={comment.id}
                header={
                  <NoteHeader
                    author={comment.user?.name ?? 'Unknown author'}
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

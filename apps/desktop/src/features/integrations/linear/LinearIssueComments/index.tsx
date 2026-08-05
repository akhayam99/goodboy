import { EmptyState } from '@goodboy/ui';
import { formatRelativeDuration } from '../../../../shared/utils/relativeDate';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { NoteCard } from '../../../../shared/components/NoteCard';
import { NoteHeader } from '../../../../shared/components/NoteHeader';
import { NoteListSkeleton } from '../../../../shared/components/NoteListSkeleton';
import type { LinearIssueComment } from '../client';

type Props = {
  readonly comments: ReadonlyArray<LinearIssueComment>;
  readonly isLoading: boolean;
  readonly error: string | null;
};

export const LinearIssueComments = ({ comments, isLoading, error }: Props) => {
  if (isLoading) {
    return <NoteListSkeleton />;
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
  );
};

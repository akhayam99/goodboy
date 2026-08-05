import { EmptyState, Skeleton } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { ErrorStrip } from '../../../../../shared/components/ErrorStrip';
import type { BitbucketComment } from '../../client';
import { PrCommentCard } from './PrCommentCard';

type Props = {
  readonly comments: ReadonlyArray<BitbucketComment>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly onRetry: () => void;
};

export const PrConversation = ({ comments, isLoading, error, onRetry }: Props) => {
  if (isLoading) {
    return (
      <div role="status" aria-label="Loading the conversation" className="flex flex-col gap-3">
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
    return <ErrorStrip label="the conversation" error={new Error(error)} onRetry={onRetry} />;
  }

  if (comments.length === 0) {
    return (
      <EmptyState
        icon={CONCEPT_ICONS.comments}
        tone={CONCEPT_TONE.comments}
        title="No comments yet"
        description="Comments on this pull request show up here. Replying comes from Bitbucket for now."
        size="inline"
        className="py-5"
      />
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {comments.map((comment) => (
        <li key={comment.id}>
          <PrCommentCard comment={comment} />
        </li>
      ))}
    </ul>
  );
};

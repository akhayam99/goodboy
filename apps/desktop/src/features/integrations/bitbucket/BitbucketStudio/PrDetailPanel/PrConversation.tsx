import { useMemo } from 'react';
import { EmptyState, Skeleton } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { ErrorStrip } from '@goodboy/ui';
import { NoteComposer } from '../../../../../shared/components/NoteComposer';
import type { BitbucketComment } from '../../client';
import { bitbucketPrThreads } from './bitbucketPrThreads';
import { PrThreadCard } from './PrThreadCard';

type ReplyParams = {
  readonly parentCommentId: number;
  readonly body: string;
};

type Props = {
  readonly comments: ReadonlyArray<BitbucketComment>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly postBlockReason: string | null;
  readonly onRetry: () => void;
  readonly onPost: ((body: string) => Promise<void>) | null;
  readonly onReply: ((params: ReplyParams) => Promise<void>) | null;
};

export const PrConversation = ({
  comments,
  isLoading,
  error,
  postBlockReason,
  onRetry,
  onPost,
  onReply,
}: Props) => {
  const threads = useMemo(() => bitbucketPrThreads({ comments }), [comments]);

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

  return (
    <div className="flex flex-col gap-4">
      {threads.length === 0 ? (
        <EmptyState
          icon={CONCEPT_ICONS.comments}
          tone={CONCEPT_TONE.comments}
          title="No comments yet"
          description="Comments on this pull request show up here. Write the first one below."
          size="inline"
          className="py-5"
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {threads.map((thread) => (
            <li key={thread.head.id}>
              <PrThreadCard
                thread={thread}
                onReply={
                  onReply == null
                    ? null
                    : (body: string) => onReply({ parentCommentId: thread.head.id, body })
                }
              />
            </li>
          ))}
        </ul>
      )}
      {onPost != null && (
        <NoteComposer placeholder="Write a comment" submitLabel="Comment" onSubmit={onPost} />
      )}
      {postBlockReason != null && (
        <p className="text-2xs text-muted-foreground">{postBlockReason}</p>
      )}
    </div>
  );
};

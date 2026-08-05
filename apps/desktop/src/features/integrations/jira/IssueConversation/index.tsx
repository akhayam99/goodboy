import { useMemo } from 'react';
import { EmptyState, Skeleton } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { ErrorStrip } from '../../../../shared/components/ErrorStrip';
import { NoteComposer } from '../../../../shared/components/NoteComposer';
import type { JiraComment } from '../client';
import { IssueNoteCard } from './IssueNoteCard';
import { buildIssueConversation } from './issueNotes';

type Props = {
  readonly comments: ReadonlyArray<JiraComment>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly onRetry: () => void;
  readonly onPost: ((body: string) => Promise<void>) | null;
};

export const IssueConversation = ({ comments, isLoading, error, onRetry, onPost }: Props) => {
  const conversation = useMemo(() => buildIssueConversation({ comments }), [comments]);

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
      {conversation.comments.length === 0 ? (
        <EmptyState
          icon={CONCEPT_ICONS.comments}
          tone={CONCEPT_TONE.comments}
          title="No comments yet"
          description="Comments on this issue show up here."
          size="inline"
          className="py-5"
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {conversation.comments.map((comment) => (
            <li key={comment.id}>
              <IssueNoteCard comment={comment} />
            </li>
          ))}
        </ul>
      )}
      {conversation.emptyCommentCount > 0 && (
        <p className="text-2xs text-muted-foreground">
          {conversation.emptyCommentCount === 1
            ? '1 comment has no readable text'
            : `${conversation.emptyCommentCount} comments have no readable text`}
        </p>
      )}
      {onPost != null && (
        <NoteComposer
          placeholder="Write a comment"
          submitLabel="Comment"
          hint="Plain text, one paragraph per line"
          onSubmit={onPost}
        />
      )}
    </div>
  );
};

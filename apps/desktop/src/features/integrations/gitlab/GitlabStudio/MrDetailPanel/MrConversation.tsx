import { useMemo } from 'react';
import { EmptyState, Skeleton } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { ErrorStrip } from '../../../../../shared/components/ErrorStrip';
import { NoteComposer } from '../../../../../shared/components/NoteComposer';
import type { GitlabMrDiscussion } from '../../client';
import { MrThreadCard } from './MrThreadCard';
import { buildMrConversation } from './mrThreads';

type Props = {
  readonly discussions: ReadonlyArray<GitlabMrDiscussion>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly onRetry: () => void;
  readonly onPost: ((body: string) => Promise<void>) | null;
  readonly onReply: ((params: { discussionId: string; body: string }) => Promise<void>) | null;
  readonly onResolve:
    ((params: { discussionId: string; resolved: boolean }) => Promise<void>) | null;
};

export const MrConversation = ({
  discussions,
  isLoading,
  error,
  onRetry,
  onPost,
  onReply,
  onResolve,
}: Props) => {
  const conversation = useMemo(() => buildMrConversation({ discussions }), [discussions]);

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
      {conversation.threads.length === 0 ? (
        <EmptyState
          icon={CONCEPT_ICONS.comments}
          tone={CONCEPT_TONE.comments}
          title="No comments yet"
          description="Notes and review threads on this merge request show up here."
          size="inline"
          className="py-5"
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {conversation.threads.map((thread) => (
            <li key={thread.id}>
              <MrThreadCard
                thread={thread}
                onReply={
                  onReply == null
                    ? null
                    : (body: string) => onReply({ discussionId: thread.id, body })
                }
                onResolve={
                  onResolve == null
                    ? null
                    : (resolved: boolean) => onResolve({ discussionId: thread.id, resolved })
                }
              />
            </li>
          ))}
        </ul>
      )}
      {conversation.systemNoteCount > 0 && (
        <p className="text-2xs text-muted-foreground">
          {conversation.systemNoteCount === 1
            ? '1 system event hidden'
            : `${conversation.systemNoteCount} system events hidden`}
        </p>
      )}
      {onPost != null && (
        <NoteComposer placeholder="Write a note" submitLabel="Comment" onSubmit={onPost} />
      )}
    </div>
  );
};

import { useMemo } from 'react';
import { EmptyState, Skeleton } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { ErrorStrip } from '../../../../shared/components/ErrorStrip';
import type { GitlabIssueNote } from '../client';
import { IssueNoteCard } from './IssueNoteCard';
import { IssueNoteComposer } from './IssueNoteComposer';
import { buildIssueConversation } from './issueNotes';

type Props = {
  readonly notes: ReadonlyArray<GitlabIssueNote>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly onRetry: () => void;
  readonly onPost: ((body: string) => Promise<void>) | null;
};

export const IssueConversation = ({ notes, isLoading, error, onRetry, onPost }: Props) => {
  const conversation = useMemo(() => buildIssueConversation({ notes }), [notes]);

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
      {conversation.notes.length === 0 ? (
        <EmptyState
          icon={CONCEPT_ICONS.comments}
          tone={CONCEPT_TONE.comments}
          title="No comments yet"
          description="Notes on this issue show up here."
          size="inline"
          className="py-5"
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {conversation.notes.map((note) => (
            <li key={note.id}>
              <IssueNoteCard note={note} />
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
        <IssueNoteComposer placeholder="Write a note" submitLabel="Comment" onSubmit={onPost} />
      )}
    </div>
  );
};

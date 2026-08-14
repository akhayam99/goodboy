import { useMemo } from 'react';
import { EmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { ErrorStrip } from '@goodboy/ui';
import { NoteComposer } from '../../../../shared/components/NoteComposer';
import { NoteListSkeleton } from '@goodboy/ui';
import type { SlackChannel, SlackMessage, SlackUser } from '../client';
import { slackChannelNames, slackUserNames } from '../nameMaps';
import type { SlackThreadActions } from '../useSlackThreadActions';
import { ThreadNoteCard } from './ThreadNoteCard';

type Props = {
  readonly messages: ReadonlyArray<SlackMessage>;
  readonly users: ReadonlyArray<SlackUser>;
  readonly channels: ReadonlyArray<SlackChannel>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly onRetry: () => void;
  readonly actions: SlackThreadActions;
};

export const ThreadConversation = ({
  messages,
  users,
  channels,
  isLoading,
  error,
  onRetry,
  actions,
}: Props) => {
  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const userNames = useMemo(() => slackUserNames({ users }), [users]);
  const channelNames = useMemo(() => slackChannelNames({ channels }), [channels]);

  if (isLoading && messages.length === 0) {
    return <NoteListSkeleton label="Loading comments" />;
  }

  if (error != null) {
    return <ErrorStrip label="the thread" error={new Error(error)} onRetry={onRetry} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {messages.length === 0 ? (
        <EmptyState
          icon={CONCEPT_ICONS.slack}
          tone={CONCEPT_TONE.slack}
          title="Nothing to read yet"
          description="The messages in this thread show up here."
          size="inline"
          className="py-5"
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {messages.map((message) => (
            <li key={message.ts}>
              <ThreadNoteCard
                message={message}
                author={message.userId != null ? (usersById.get(message.userId) ?? null) : null}
                userNames={userNames}
                channelNames={channelNames}
                isWriting={actions.isWriting}
                onReact={actions.react}
              />
            </li>
          ))}
        </ul>
      )}
      {actions.error != null && (
        <p role="alert" className="text-xs text-danger">
          {actions.error}
        </p>
      )}
      {actions.reply != null && (
        <div className="flex flex-col gap-2">
          <p className="text-2xs text-muted-foreground">
            Replies post to Slack as the connected bot, not as you.
          </p>
          <NoteComposer
            placeholder="Reply in thread"
            submitLabel="Reply"
            hint="Sent as plain text"
            onSubmit={actions.reply}
          />
        </div>
      )}
    </div>
  );
};

import { useMemo } from 'react';
import { EmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { ErrorStrip } from '../../../../shared/components/ErrorStrip';
import { NoteListSkeleton } from '../../../../shared/components/NoteListSkeleton';
import type { SlackChannel, SlackMessage, SlackUser } from '../client';
import { slackChannelNames, slackUserNames } from '../nameMaps';
import { ThreadNoteCard } from './ThreadNoteCard';

type Props = {
  readonly messages: ReadonlyArray<SlackMessage>;
  readonly users: ReadonlyArray<SlackUser>;
  readonly channels: ReadonlyArray<SlackChannel>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly onRetry: () => void;
};

export const ThreadConversation = ({
  messages,
  users,
  channels,
  isLoading,
  error,
  onRetry,
}: Props) => {
  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const userNames = useMemo(() => slackUserNames({ users }), [users]);
  const channelNames = useMemo(() => slackChannelNames({ channels }), [channels]);

  if (isLoading && messages.length === 0) {
    return <NoteListSkeleton />;
  }

  if (error != null) {
    return <ErrorStrip label="the thread" error={new Error(error)} onRetry={onRetry} />;
  }

  if (messages.length === 0) {
    return (
      <EmptyState
        icon={CONCEPT_ICONS.slack}
        tone={CONCEPT_TONE.slack}
        title="Nothing to read yet"
        description="The messages in this thread show up here."
        size="inline"
        className="py-5"
      />
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {messages.map((message) => (
        <li key={message.ts}>
          <ThreadNoteCard
            message={message}
            author={message.userId != null ? (usersById.get(message.userId) ?? null) : null}
            userNames={userNames}
            channelNames={channelNames}
          />
        </li>
      ))}
    </ul>
  );
};

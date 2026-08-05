import { NoteCard } from '../../../../shared/components/NoteCard';
import type { SlackMessage, SlackUser } from '../client';
import { slackMrkdwnToMarkdown } from '../slackMrkdwnToMarkdown';
import { ThreadNoteHeader } from './ThreadNoteHeader';

type Props = {
  readonly message: SlackMessage;
  readonly author: SlackUser | null;
  readonly userNames: ReadonlyMap<string, string>;
  readonly channelNames: ReadonlyMap<string, string>;
};

export const ThreadNoteCard = ({ message, author, userNames, channelNames }: Props) => (
  <NoteCard
    header={<ThreadNoteHeader message={message} author={author} />}
    body={slackMrkdwnToMarkdown({ text: message.text, userNames, channelNames })}
  />
);

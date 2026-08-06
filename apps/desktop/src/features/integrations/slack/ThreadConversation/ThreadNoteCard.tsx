import { NoteCard } from '../../../../shared/components/NoteCard';
import type { SlackMessage, SlackUser } from '../client';
import { slackMrkdwnToMarkdown } from '../slackMrkdwnToMarkdown';
import type { SlackReactionPick } from '../useSlackThreadActions';
import { ThreadNoteHeader } from './ThreadNoteHeader';
import { ThreadReactions } from './ThreadReactions';

type Props = {
  readonly message: SlackMessage;
  readonly author: SlackUser | null;
  readonly userNames: ReadonlyMap<string, string>;
  readonly channelNames: ReadonlyMap<string, string>;
  readonly isWriting: boolean;
  readonly onReact: ((pick: SlackReactionPick) => void) | null;
};

export const ThreadNoteCard = ({
  message,
  author,
  userNames,
  channelNames,
  isWriting,
  onReact,
}: Props) => (
  <NoteCard
    header={<ThreadNoteHeader message={message} author={author} />}
    body={slackMrkdwnToMarkdown({ text: message.text, userNames, channelNames })}
    footer={
      <ThreadReactions
        messageTs={message.ts}
        reactions={message.reactions}
        isWriting={isWriting}
        onReact={onReact}
      />
    }
  />
);

import type { SlackMessage } from './client';
import { slackMrkdwnToMarkdown } from './slackMrkdwnToMarkdown';

const GOAL_CHAR_CAP = 2000;
const UNKNOWN_AUTHOR = 'Someone';

type Params = {
  readonly channelName: string;
  readonly messages: ReadonlyArray<SlackMessage>;
  readonly userNames?: ReadonlyMap<string, string>;
};

export const goalFromThread = ({ channelName, messages, userNames }: Params): string => {
  const heading = `Slack thread in #${channelName}`;
  const body = messages
    .map((message) => {
      const author =
        message.userId != null
          ? (userNames?.get(message.userId) ?? message.userId)
          : UNKNOWN_AUTHOR;
      const text = slackMrkdwnToMarkdown({
        text: message.text,
        ...(userNames != null && { userNames }),
      }).trim();
      if (text === '') {
        return '';
      }
      return `${author}: ${text}`;
    })
    .filter((line) => line !== '')
    .join('\n\n');

  if (body === '') {
    return heading;
  }
  const capped = body.length > GOAL_CHAR_CAP ? `${body.slice(0, GOAL_CHAR_CAP).trimEnd()}…` : body;
  return `${heading}\n\n${capped}`;
};

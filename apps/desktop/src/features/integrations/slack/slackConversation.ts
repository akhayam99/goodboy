import type {
  ConversationCapabilities,
  ConversationThread,
} from '../../../shared/components/Conversation/types';
import type { SlackMessage, SlackUser } from './client';
import { slackMrkdwnToMarkdown } from './slackMrkdwnToMarkdown';

export const SLACK_THREAD_CAPABILITIES = {
  reply: 'none',
  startThread: false,
  resolve: false,
  react: true,
} satisfies ConversationCapabilities;

type Params = {
  readonly messages: ReadonlyArray<SlackMessage>;
  readonly usersById: ReadonlyMap<string, SlackUser>;
  readonly userNames: ReadonlyMap<string, string>;
  readonly channelNames: ReadonlyMap<string, string>;
};

export const slackConversation = ({
  messages,
  usersById,
  userNames,
  channelNames,
}: Params): ReadonlyArray<ConversationThread> =>
  messages.map((message) => {
    const author = message.userId == null ? null : (usersById.get(message.userId) ?? null);
    return {
      id: message.ts,
      head: {
        id: message.ts,
        author: {
          name: author?.name ?? message.userId ?? 'Unknown',
          avatarUrl: author?.avatarUrl ?? null,
          handle: null,
        },
        createdAt: message.postedAt ?? '',
        body: slackMrkdwnToMarkdown({ text: message.text, userNames, channelNames }),
        status: 'sent',
      },
      replies: [],
      anchor: null,
      isResolved: null,
    };
  });

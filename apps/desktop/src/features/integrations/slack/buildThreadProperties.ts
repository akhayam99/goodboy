import type { SlackThreadProperties } from '../../../shared/detail-fields';
import type { SlackMessage } from './client';

type Params = {
  readonly channelName: string;
  readonly messages: ReadonlyArray<SlackMessage>;
  readonly userNames: ReadonlyMap<string, string>;
  readonly selfUserId: string | null;
};

export const buildThreadProperties = ({
  channelName,
  messages,
  userNames,
  selfUserId,
}: Params): SlackThreadProperties => {
  const participants: string[] = [];
  for (const message of messages) {
    const userId = message.userId;
    if (userId == null) {
      continue;
    }
    const name = userNames.get(userId) ?? userId;
    if (!participants.includes(name)) {
      participants.push(name);
    }
  }
  const root = messages[0] ?? null;
  const lastReply = messages.at(-1) ?? null;
  return {
    channelName,
    participants,
    replyCount: Math.max(0, messages.length - 1),
    lastActivityAt: lastReply?.postedAt ?? root?.postedAt ?? null,
    isAnswered:
      selfUserId === null || selfUserId === '' || lastReply === null
        ? null
        : lastReply.userId === selfUserId,
  };
};

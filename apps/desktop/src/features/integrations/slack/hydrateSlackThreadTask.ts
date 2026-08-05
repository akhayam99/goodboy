import type { SlackChannel, SlackMessage } from './client';
import { slackThreadIdentifier, slackThreadTitle } from './threadFormulas';

type Params = {
  readonly channelId: string;
  readonly threadTs: string;
  readonly channels: ReadonlyArray<SlackChannel>;
  readonly messages: ReadonlyArray<SlackMessage>;
};

type Result = {
  readonly identifier: string;
  readonly title: string;
};

export const hydrateSlackThreadTask = ({
  channelId,
  threadTs,
  channels,
  messages,
}: Params): Result | null => {
  const channelName = channels.find((channel) => channel.id === channelId)?.name ?? channelId;
  const root = messages.find((message) => message.ts === threadTs) ?? messages[0] ?? null;
  if (root == null) {
    return null;
  }
  const text = root.text;
  return {
    identifier: slackThreadIdentifier({ channelName, text }),
    title: slackThreadTitle({ text }),
  };
};

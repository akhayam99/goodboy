import type { WorkspaceId } from '@goodboy/types';
import type { IssueCandidate } from '../fetchIssueCandidates';
import {
  slackGetPermalink,
  slackListChannels,
  slackListThreadHeads,
  slackListUsers,
  type SlackChannel,
  type SlackMessage,
} from './client';
import { goalFromThread } from './goal-from-thread';
import { slackUserNames } from './nameMaps';
import {
  slackThreadBranchSlug,
  slackThreadExternalId,
  slackThreadIdentifier,
  slackThreadTitle,
} from './threadFormulas';

const CHANNEL_CAP = 12;
const CANDIDATE_CAP = 25;

type Params = {
  readonly workspaceId: WorkspaceId;
};

type Head = {
  readonly channel: SlackChannel;
  readonly head: SlackMessage;
};

const headTimestamp = (head: SlackMessage): string => head.latestReplyAt ?? head.postedAt ?? '';

export const slackThreadCandidates = async ({
  workspaceId,
}: Params): Promise<ReadonlyArray<IssueCandidate>> => {
  const [channels, users] = await Promise.all([
    slackListChannels({ workspaceId }),
    slackListUsers({ workspaceId }),
  ]);
  const userNames = slackUserNames({ users });
  const perChannel = await Promise.all(
    channels.slice(0, CHANNEL_CAP).map(async (channel) => {
      const heads = await slackListThreadHeads({ workspaceId, channelId: channel.id });
      return heads.map((head) => ({ channel, head }) satisfies Head);
    }),
  );
  const ranked = perChannel
    .flat()
    .sort((left, right) => headTimestamp(right.head).localeCompare(headTimestamp(left.head)))
    .slice(0, CANDIDATE_CAP);

  return Promise.all(
    ranked.map(async ({ channel, head }) => {
      const threadTs = head.threadTs ?? head.ts;
      const url = await slackGetPermalink({
        workspaceId,
        channelId: channel.id,
        messageTs: threadTs,
      }).catch(() => '');
      return {
        provider: 'slack',
        externalId: slackThreadExternalId({ channelId: channel.id, threadTs }),
        identifier: slackThreadIdentifier({ channelName: channel.name, text: head.text }),
        title: slackThreadTitle({ text: head.text }),
        url,
        goal: goalFromThread({ channelName: channel.name, messages: [head], userNames }),
        branchSlug: slackThreadBranchSlug({ text: head.text }),
      } satisfies IssueCandidate;
    }),
  );
};

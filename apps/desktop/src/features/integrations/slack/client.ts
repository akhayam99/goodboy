import { invokeCommand } from '../../../shared/lib/invokeCommand';
import type { IntegrationCredentialId, IsoDateTime, WorkspaceId } from '@goodboy/types';

export type SlackConnection = {
  readonly teamId: string;
  readonly teamName: string;
  readonly userId: string;
  readonly userName: string;
};

export type SlackChannel = {
  readonly id: string;
  readonly name: string;
  readonly isMember: boolean;
  readonly topic: string | null;
  readonly memberCount: number | null;
};

export type SlackReaction = {
  readonly name: string;
  readonly count: number;
};

export type SlackMessage = {
  readonly ts: string;
  readonly threadTs: string | null;
  readonly userId: string | null;
  readonly botId: string | null;
  readonly text: string;
  readonly subtype: string | null;
  readonly replyCount: number;
  readonly replyUserCount: number;
  readonly postedAt: IsoDateTime | null;
  readonly latestReplyAt: IsoDateTime | null;
  readonly reactions: ReadonlyArray<SlackReaction>;
};

export type SlackUser = {
  readonly id: string;
  readonly name: string;
  readonly isBot: boolean;
  readonly isDeleted: boolean;
  readonly avatarUrl: string | null;
};

type ValidateParams = {
  readonly credentialId: IntegrationCredentialId;
  readonly userToken: string | null;
};

export const slackValidateConnection = async ({
  credentialId,
  userToken,
}: ValidateParams): Promise<SlackConnection> =>
  invokeCommand<SlackConnection>('slack_validate_connection', { credentialId, userToken });

type ConnectParams = {
  readonly credentialId: IntegrationCredentialId;
  readonly userToken: string | null;
};

export const slackConnect = async ({ credentialId, userToken }: ConnectParams): Promise<void> => {
  await invokeCommand('slack_connect', { credentialId, userToken });
};

type WorkspaceParams = {
  readonly workspaceId: WorkspaceId;
};

export const slackListChannels = async ({
  workspaceId,
}: WorkspaceParams): Promise<ReadonlyArray<SlackChannel>> =>
  invokeCommand<ReadonlyArray<SlackChannel>>('slack_list_channels', { workspaceId });

export const slackListUsers = async ({
  workspaceId,
}: WorkspaceParams): Promise<ReadonlyArray<SlackUser>> =>
  invokeCommand<ReadonlyArray<SlackUser>>('slack_list_users', { workspaceId });

type ChannelParams = WorkspaceParams & {
  readonly channelId: string;
};

export const slackListThreadHeads = async ({
  workspaceId,
  channelId,
}: ChannelParams): Promise<ReadonlyArray<SlackMessage>> =>
  invokeCommand<ReadonlyArray<SlackMessage>>('slack_list_thread_heads', { workspaceId, channelId });

type ThreadParams = ChannelParams & {
  readonly threadTs: string;
};

export const slackGetThread = async ({
  workspaceId,
  channelId,
  threadTs,
}: ThreadParams): Promise<ReadonlyArray<SlackMessage>> =>
  invokeCommand<ReadonlyArray<SlackMessage>>('slack_get_thread', {
    workspaceId,
    channelId,
    threadTs,
  });

type MessageParams = ChannelParams & {
  readonly messageTs: string;
};

export const slackGetPermalink = async ({
  workspaceId,
  channelId,
  messageTs,
}: MessageParams): Promise<string> =>
  invokeCommand<string>('slack_get_permalink', { workspaceId, channelId, messageTs });

type ReplyParams = ThreadParams & {
  readonly text: string;
};

export const slackPostReply = async ({
  workspaceId,
  channelId,
  threadTs,
  text,
}: ReplyParams): Promise<SlackMessage> =>
  invokeCommand<SlackMessage>('slack_post_reply', { workspaceId, channelId, threadTs, text });

type ReactionParams = MessageParams & {
  readonly name: string;
};

export const slackAddReaction = async ({
  workspaceId,
  channelId,
  messageTs,
  name,
}: ReactionParams): Promise<void> => {
  await invokeCommand('slack_add_reaction', { workspaceId, channelId, messageTs, name });
};

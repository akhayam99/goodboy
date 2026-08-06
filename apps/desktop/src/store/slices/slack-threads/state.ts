import type { IsoDateTime, WorkspaceId } from '@goodboy/types';
import type {
  SlackChannel,
  SlackMessage,
  SlackUser,
} from '../../../features/integrations/slack/client';

export type SlackChannelsEntry = {
  readonly channels: ReadonlyArray<SlackChannel>;
  readonly loading: boolean;
  readonly error: string | null;
};

export type SlackThreadHeadsEntry = {
  readonly heads: ReadonlyArray<SlackMessage>;
  readonly loading: boolean;
  readonly error: string | null;
};

export type SlackThreadEntry = {
  readonly messages: ReadonlyArray<SlackMessage>;
  readonly fetchedAt: IsoDateTime | null;
  readonly loading: boolean;
  readonly error: string | null;
};

export type SlackThreadsSliceState = {
  readonly slackChannels: Readonly<Record<WorkspaceId, SlackChannelsEntry>>;
  readonly slackUsers: Readonly<Record<WorkspaceId, ReadonlyArray<SlackUser>>>;
  readonly slackThreadHeads: Readonly<Record<string, SlackThreadHeadsEntry>>;
  readonly slackThreads: Readonly<Record<string, SlackThreadEntry>>;
};

export const initialSlackThreadsState: SlackThreadsSliceState = {
  slackChannels: {},
  slackUsers: {},
  slackThreadHeads: {},
  slackThreads: {},
};

type ChannelKeyParams = {
  readonly workspaceId: WorkspaceId;
  readonly channelId: string;
};

export const slackChannelKey = ({ workspaceId, channelId }: ChannelKeyParams): string =>
  `${workspaceId}:${channelId}`;

type ThreadKeyParams = ChannelKeyParams & {
  readonly threadTs: string;
};

export const slackThreadKey = ({ workspaceId, channelId, threadTs }: ThreadKeyParams): string =>
  `${workspaceId}:${channelId}:${threadTs}`;

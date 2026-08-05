import type { SlackChannel, SlackUser } from './client';

type UserParams = {
  readonly users: ReadonlyArray<SlackUser>;
};

export const slackUserNames = ({ users }: UserParams): ReadonlyMap<string, string> =>
  new Map(users.map((user) => [user.id, user.name]));

type ChannelParams = {
  readonly channels: ReadonlyArray<SlackChannel>;
};

export const slackChannelNames = ({ channels }: ChannelParams): ReadonlyMap<string, string> =>
  new Map(channels.map((channel) => [channel.id, channel.name]));

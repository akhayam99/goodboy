import type { IsoDateTime, WorkspaceId } from '@goodboy/types';
import type {
  SlackChannel,
  SlackMessage,
  SlackUser,
} from '../../../features/integrations/slack/client';

type SlackChannelsEntry = {
  readonly channels: ReadonlyArray<SlackChannel>;
  readonly loading: boolean;
  readonly error: string | null;
};

type SlackThreadHeadsEntry = {
  readonly heads: ReadonlyArray<SlackMessage>;
  readonly loading: boolean;
  readonly error: string | null;
};

type SlackThreadEntry = {
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

export const SLACK_THREAD_CACHE_LIMIT = 50;

type ThreadsParams = {
  readonly threads: SlackThreadsSliceState['slackThreads'];
};

export const capSlackThreads = ({
  threads,
}: ThreadsParams): SlackThreadsSliceState['slackThreads'] => {
  const keys = Object.keys(threads);
  const excess = keys.length - SLACK_THREAD_CACHE_LIMIT;
  if (excess <= 0) {
    return threads;
  }
  const oldestFirst = keys
    .filter((key) => threads[key]?.loading !== true)
    .sort((a, b) => (threads[a]?.fetchedAt ?? '').localeCompare(threads[b]?.fetchedAt ?? ''));
  const evicted = new Set(oldestFirst.slice(0, excess));
  return Object.fromEntries(Object.entries(threads).filter(([key]) => !evicted.has(key)));
};

type PruneParams = {
  readonly state: SlackThreadsSliceState;
  readonly workspaceId: WorkspaceId;
};

const withoutWorkspace = <T>({
  record,
  workspaceId,
}: {
  readonly record: Readonly<Record<string, T>>;
  readonly workspaceId: WorkspaceId;
}): Readonly<Record<string, T>> =>
  Object.fromEntries(
    Object.entries(record).filter(
      ([key]) => key !== workspaceId && !key.startsWith(`${workspaceId}:`),
    ),
  );

export const pruneSlackWorkspace = ({
  state,
  workspaceId,
}: PruneParams): SlackThreadsSliceState => ({
  slackChannels: withoutWorkspace({ record: state.slackChannels, workspaceId }),
  slackUsers: withoutWorkspace({ record: state.slackUsers, workspaceId }),
  slackThreadHeads: withoutWorkspace({ record: state.slackThreadHeads, workspaceId }),
  slackThreads: withoutWorkspace({ record: state.slackThreads, workspaceId }),
});

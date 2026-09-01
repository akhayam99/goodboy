import { useCallback, useEffect, useMemo } from 'react';
import type { Session, SessionExternalTask, SessionId, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessions } from '../../../../store';
import { slackChannelKey } from '../../../../store/slices/slack-threads';
import type { SlackChannel, SlackMessage, SlackUser } from '../client';
import { slackThreadExternalId } from '../threadFormulas';

const CHANNEL_FETCH_CAP = 12;

export type SlackThreadRow = {
  readonly channel: SlackChannel;
  readonly head: SlackMessage;
  readonly sessionId: SessionId | null;
};

export type SlackThreadGroup = {
  readonly key: string;
  readonly label: string;
  readonly rows: ReadonlyArray<SlackThreadRow>;
};

type SessionMatchParams = {
  readonly sessions: ReadonlyArray<Session>;
  readonly sessionExternalTasks: Readonly<Record<string, ReadonlyArray<SessionExternalTask>>>;
};

const resolveThreadSessions = ({
  sessions,
  sessionExternalTasks,
}: SessionMatchParams): ReadonlyMap<string, SessionId> => {
  const byExternalId = new Map<string, SessionId>();
  for (const session of sessions) {
    const tasks = sessionExternalTasks[session.id] ?? [];
    for (const task of tasks) {
      if (task.provider === 'slack' && !byExternalId.has(task.externalId)) {
        byExternalId.set(task.externalId, session.id);
      }
    }
  }
  return byExternalId;
};

const headTimestamp = (head: SlackMessage): string => head.latestReplyAt ?? head.postedAt ?? '';

type GroupParams = {
  readonly channels: ReadonlyArray<SlackChannel>;
  readonly headsByChannelId: ReadonlyMap<string, ReadonlyArray<SlackMessage>>;
  readonly sessionIdByExternalId: ReadonlyMap<string, SessionId>;
};

const buildThreadGroups = ({
  channels,
  headsByChannelId,
  sessionIdByExternalId,
}: GroupParams): ReadonlyArray<SlackThreadGroup> =>
  channels
    .map((channel) => {
      const heads = headsByChannelId.get(channel.id) ?? [];
      const rows = heads
        .map((head) => ({
          channel,
          head,
          sessionId:
            sessionIdByExternalId.get(
              slackThreadExternalId({ channelId: channel.id, threadTs: head.threadTs ?? head.ts }),
            ) ?? null,
        }))
        .sort((left, right) => headTimestamp(right.head).localeCompare(headTimestamp(left.head)));
      return { key: channel.id, label: `#${channel.name}`, rows };
    })
    .filter((group) => group.rows.length > 0)
    .sort((left, right) =>
      headTimestamp(right.rows[0]!.head).localeCompare(headTimestamp(left.rows[0]!.head)),
    );

export type UseSlackThreads = {
  readonly groups: ReadonlyArray<SlackThreadGroup>;
  readonly channels: ReadonlyArray<SlackChannel>;
  readonly users: ReadonlyArray<SlackUser>;
  readonly hiddenChannelCount: number;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
};

type HookParams = {
  readonly workspaceId: WorkspaceId;
  readonly isEnabled: boolean;
};

export const useSlackThreads = ({ workspaceId, isEnabled }: HookParams): UseSlackThreads => {
  const sessions = useSessions();
  const sessionExternalTasks = useAppStore((state) => state.sessionExternalTasks);
  const channelsEntry = useAppStore((state) => state.slackChannels[workspaceId] ?? null);
  const threadHeads = useAppStore((state) => state.slackThreadHeads);
  const users = useAppStore((state) => state.slackUsers[workspaceId] ?? EMPTY_ARRAY);

  const load = useCallback(async () => {
    if (!isEnabled) {
      return;
    }
    const store = useAppStore.getState();
    await Promise.all([
      store.refreshSlackChannels({ workspaceId }),
      store.refreshSlackUsers({ workspaceId }),
    ]);
    const channels = useAppStore.getState().slackChannels[workspaceId]?.channels ?? [];
    await Promise.all(
      channels
        .slice(0, CHANNEL_FETCH_CAP)
        .map((channel) =>
          useAppStore.getState().refreshSlackThreadHeads({ workspaceId, channelId: channel.id }),
        ),
    );
  }, [workspaceId, isEnabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const refetch = useCallback(() => {
    void load();
  }, [load]);

  const visibleChannels = useMemo(
    () => (channelsEntry?.channels ?? EMPTY_ARRAY).slice(0, CHANNEL_FETCH_CAP),
    [channelsEntry],
  );

  const headsByChannelId = useMemo(() => {
    const map = new Map<string, ReadonlyArray<SlackMessage>>();
    for (const channel of visibleChannels) {
      const entry = threadHeads[slackChannelKey({ workspaceId, channelId: channel.id })];
      if (entry != null) {
        map.set(channel.id, entry.heads);
      }
    }
    return map;
  }, [visibleChannels, threadHeads, workspaceId]);

  const sessionIdByExternalId = useMemo(
    () => resolveThreadSessions({ sessions, sessionExternalTasks }),
    [sessions, sessionExternalTasks],
  );

  const groups = useMemo(
    () => buildThreadGroups({ channels: visibleChannels, headsByChannelId, sessionIdByExternalId }),
    [visibleChannels, headsByChannelId, sessionIdByExternalId],
  );

  const headEntries = visibleChannels.map(
    (channel) => threadHeads[slackChannelKey({ workspaceId, channelId: channel.id })] ?? null,
  );
  const headError = headEntries.find((entry) => entry?.error != null)?.error ?? null;

  return {
    groups,
    channels: channelsEntry?.channels ?? EMPTY_ARRAY,
    users,
    hiddenChannelCount: Math.max(
      0,
      (channelsEntry?.channels ?? EMPTY_ARRAY).length - CHANNEL_FETCH_CAP,
    ),
    isLoading:
      channelsEntry?.loading === true || headEntries.some((entry) => entry?.loading === true),
    error: channelsEntry?.error ?? headError,
    refetch,
  };
};

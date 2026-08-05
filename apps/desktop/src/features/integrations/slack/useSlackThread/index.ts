import { useCallback, useEffect } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { slackThreadKey } from '../../../../store/slices/slack-threads';
import type { SlackChannel, SlackMessage, SlackUser } from '../client';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly channelId: string;
  readonly threadTs: string;
  readonly isEnabled: boolean;
};

export type UseSlackThread = {
  readonly messages: ReadonlyArray<SlackMessage>;
  readonly users: ReadonlyArray<SlackUser>;
  readonly channels: ReadonlyArray<SlackChannel>;
  readonly channelName: string;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
};

export const useSlackThread = ({
  workspaceId,
  channelId,
  threadTs,
  isEnabled,
}: Params): UseSlackThread => {
  const key = slackThreadKey({ workspaceId, channelId, threadTs });
  const entry = useAppStore((state) => state.slackThreads[key] ?? null);
  const users = useAppStore((state) => state.slackUsers[workspaceId] ?? EMPTY_ARRAY);
  const channelsEntry = useAppStore((state) => state.slackChannels[workspaceId] ?? null);

  const load = useCallback(
    async (force: boolean) => {
      if (!isEnabled) {
        return;
      }
      const state = useAppStore.getState();
      const pending: Array<Promise<void>> = [
        state.refreshSlackThread({ workspaceId, channelId, threadTs }, { force }),
      ];
      if (state.slackUsers[workspaceId] == null) {
        pending.push(state.refreshSlackUsers({ workspaceId }));
      }
      if (state.slackChannels[workspaceId] == null) {
        pending.push(state.refreshSlackChannels({ workspaceId }));
      }
      await Promise.all(pending);
    },
    [workspaceId, channelId, threadTs, isEnabled],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const refetch = useCallback(() => {
    void load(true);
  }, [load]);

  const channels = channelsEntry?.channels ?? EMPTY_ARRAY;

  return {
    messages: entry?.messages ?? EMPTY_ARRAY,
    users,
    channels,
    channelName: channels.find((channel) => channel.id === channelId)?.name ?? channelId,
    isLoading: entry?.loading === true,
    error: entry?.error ?? null,
    refetch,
  };
};

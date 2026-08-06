import { slackListChannels } from '../../../features/integrations/slack/client';
import { formatError } from '../../../shared/lib/errors';
import type { GetFn, SetFn, SlackWorkspaceParams } from './types';

export const refreshSlackChannels = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId }: SlackWorkspaceParams): Promise<void> => {
    const current = get().slackChannels[workspaceId];
    set((state) => ({
      slackChannels: {
        ...state.slackChannels,
        [workspaceId]: { channels: current?.channels ?? [], loading: true, error: null },
      },
    }));
    try {
      const channels = await slackListChannels({ workspaceId });
      set((state) => ({
        slackChannels: {
          ...state.slackChannels,
          [workspaceId]: { channels, loading: false, error: null },
        },
      }));
    } catch (error) {
      set((state) => ({
        slackChannels: {
          ...state.slackChannels,
          [workspaceId]: {
            channels: state.slackChannels[workspaceId]?.channels ?? [],
            loading: false,
            error: formatError(error),
          },
        },
      }));
    }
  };
};

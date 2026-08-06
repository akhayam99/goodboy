import { slackListThreadHeads } from '../../../features/integrations/slack/client';
import { formatError } from '../../../shared/lib/errors';
import { slackChannelKey } from './state';
import type { GetFn, SetFn, SlackChannelParams } from './types';

export const refreshSlackThreadHeads = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId, channelId }: SlackChannelParams): Promise<void> => {
    const key = slackChannelKey({ workspaceId, channelId });
    const current = get().slackThreadHeads[key];
    set((state) => ({
      slackThreadHeads: {
        ...state.slackThreadHeads,
        [key]: { heads: current?.heads ?? [], loading: true, error: null },
      },
    }));
    try {
      const heads = await slackListThreadHeads({ workspaceId, channelId });
      set((state) => ({
        slackThreadHeads: {
          ...state.slackThreadHeads,
          [key]: { heads, loading: false, error: null },
        },
      }));
    } catch (error) {
      set((state) => ({
        slackThreadHeads: {
          ...state.slackThreadHeads,
          [key]: {
            heads: state.slackThreadHeads[key]?.heads ?? [],
            loading: false,
            error: formatError(error),
          },
        },
      }));
    }
  };
};

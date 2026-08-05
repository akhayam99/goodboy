import type { IsoDateTime } from '@goodboy/types';
import { slackGetThread } from '../../../features/integrations/slack/client';
import { formatError } from '../../../shared/lib/errors';
import { slackThreadKey } from './state';
import type { GetFn, SetFn, SlackThreadParams } from './types';

export type RefreshSlackThreadOptions = {
  readonly force?: boolean;
};

export const refreshSlackThread = (set: SetFn, get: GetFn) => {
  return async (
    { workspaceId, channelId, threadTs }: SlackThreadParams,
    options?: RefreshSlackThreadOptions,
  ): Promise<void> => {
    const key = slackThreadKey({ workspaceId, channelId, threadTs });
    const current = get().slackThreads[key];
    if (options?.force !== true && current?.loading === true) {
      return;
    }
    set((state) => ({
      slackThreads: {
        ...state.slackThreads,
        [key]: {
          messages: current?.messages ?? [],
          fetchedAt: current?.fetchedAt ?? null,
          loading: true,
          error: null,
        },
      },
    }));
    try {
      const messages = await slackGetThread({ workspaceId, channelId, threadTs });
      set((state) => ({
        slackThreads: {
          ...state.slackThreads,
          [key]: {
            messages,
            fetchedAt: new Date().toISOString() as IsoDateTime,
            loading: false,
            error: null,
          },
        },
      }));
    } catch (error) {
      set((state) => ({
        slackThreads: {
          ...state.slackThreads,
          [key]: {
            messages: state.slackThreads[key]?.messages ?? [],
            fetchedAt: state.slackThreads[key]?.fetchedAt ?? null,
            loading: false,
            error: formatError(error),
          },
        },
      }));
    }
  };
};

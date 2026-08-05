import { slackListUsers } from '../../../features/integrations/slack/client';
import type { GetFn, SetFn, SlackWorkspaceParams } from './types';

export const refreshSlackUsers = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId }: SlackWorkspaceParams): Promise<void> => {
    try {
      const users = await slackListUsers({ workspaceId });
      set((state) => ({ slackUsers: { ...state.slackUsers, [workspaceId]: users } }));
    } catch {
      const known = get().slackUsers[workspaceId];
      if (known != null) {
        return;
      }
      set((state) => ({ slackUsers: { ...state.slackUsers, [workspaceId]: [] } }));
    }
  };
};

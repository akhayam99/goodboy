import { addSlackReaction } from './addSlackReaction';
import { refreshSlackChannels } from './refreshSlackChannels';
import { refreshSlackThread } from './refreshSlackThread';
import { refreshSlackThreadHeads } from './refreshSlackThreadHeads';
import { refreshSlackUsers } from './refreshSlackUsers';
import { replyToSlackThread } from './replyToSlackThread';
import type { GetFn, SetFn } from './types';

export { initialSlackThreadsState, slackChannelKey, slackThreadKey } from './state';
export type { RefreshSlackThreadOptions } from './refreshSlackThread';
export type {
  SlackChannelParams,
  SlackReactionParams,
  SlackReplyParams,
  SlackThreadParams,
  SlackWorkspaceParams,
} from './types';

export const createSlackThreadsSlice = (set: SetFn, get: GetFn) => ({
  refreshSlackChannels: refreshSlackChannels(set, get),
  refreshSlackUsers: refreshSlackUsers(set, get),
  refreshSlackThreadHeads: refreshSlackThreadHeads(set, get),
  refreshSlackThread: refreshSlackThread(set, get),
  replyToSlackThread: replyToSlackThread(get),
  addSlackReaction: addSlackReaction(get),
});

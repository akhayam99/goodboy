import { addSlackReaction } from './addSlackReaction';
import { refreshSlackChannels } from './refreshSlackChannels';
import { refreshSlackThread } from './refreshSlackThread';
import { refreshSlackThreadHeads } from './refreshSlackThreadHeads';
import { refreshSlackUsers } from './refreshSlackUsers';
import { replyToSlackThread } from './replyToSlackThread';
import type { SliceDeps } from '../../slice-types';

export { initialSlackThreadsState, slackChannelKey, slackThreadKey } from './state';

export const createSlackThreadsSlice = ({ set, get }: SliceDeps) => ({
  refreshSlackChannels: refreshSlackChannels(set, get),
  refreshSlackUsers: refreshSlackUsers(set, get),
  refreshSlackThreadHeads: refreshSlackThreadHeads(set, get),
  refreshSlackThread: refreshSlackThread(set, get),
  replyToSlackThread: replyToSlackThread(get),
  addSlackReaction: addSlackReaction(get),
});

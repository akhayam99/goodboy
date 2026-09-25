import { drainAgentQueue } from './drainAgentQueue';
import { enqueueAgentMessage } from './enqueueAgentMessage';
import { loadAgentQueues } from './loadAgentQueues';
import { removeQueuedMessage } from './removeQueuedMessage';
import { sendAgentMessageNow } from './sendAgentMessageNow';
import { sendQueuedNow } from './sendQueuedNow';
import { takeQueuedMessage } from './takeQueuedMessage';
import type { GetFn, SetFn } from './types';

export const createAgentQueueSlice = (set: SetFn, get: GetFn) => {
  return {
    loadAgentQueues: loadAgentQueues(set, get),
    enqueueAgentMessage: enqueueAgentMessage(set, get),
    removeQueuedMessage: removeQueuedMessage(set, get),
    takeQueuedMessage: takeQueuedMessage(set, get),
    drainAgentQueue: drainAgentQueue(set, get),
    sendQueuedNow: sendQueuedNow(set, get),
    sendAgentMessageNow: sendAgentMessageNow(get),
  };
};

import { drainAgentQueue } from './drainAgentQueue';
import { drainSessionQueues } from './drainSessionQueues';
import { enqueueAgentMessage } from './enqueueAgentMessage';
import { loadAgentQueues } from './loadAgentQueues';
import { removeQueuedMessage } from './removeQueuedMessage';
import { retryQueuedMessage } from './retryQueuedMessage';
import { sendAgentMessage } from './sendAgentMessage';
import { sendAgentMessageNow } from './sendAgentMessageNow';
import { sendQueuedNow } from './sendQueuedNow';
import { takeQueuedMessage } from './takeQueuedMessage';
import type { SliceDeps } from '../../slice-types';

export const createAgentQueueSlice = ({ set, get }: SliceDeps) => {
  return {
    loadAgentQueues: loadAgentQueues(set, get),
    enqueueAgentMessage: enqueueAgentMessage(set, get),
    removeQueuedMessage: removeQueuedMessage(set, get),
    takeQueuedMessage: takeQueuedMessage(set, get),
    drainAgentQueue: drainAgentQueue(set, get),
    drainSessionQueues: drainSessionQueues({ get }),
    sendQueuedNow: sendQueuedNow(set, get),
    sendAgentMessage: sendAgentMessage({ set, get }),
    sendAgentMessageNow: sendAgentMessageNow(get),
    retryQueuedMessage: retryQueuedMessage({ set, get }),
  };
};

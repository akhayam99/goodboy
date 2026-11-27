import { drainChatQueue } from './drainChatQueue';
import { enqueueChatMessage } from './enqueueChatMessage';
import { removeQueuedChatMessage } from './removeQueuedChatMessage';
import { retryQueuedChatMessage } from './retryQueuedChatMessage';
import { submitChatMessage } from './submitChatMessage';
import { takeQueuedChatMessage } from './takeQueuedChatMessage';
import type { SliceDeps } from '../../slice-types';

export const createChatQueueSlice = ({ set, get }: SliceDeps) => ({
  enqueueChatMessage: enqueueChatMessage({ set, get }),
  removeQueuedChatMessage: removeQueuedChatMessage({ set, get }),
  takeQueuedChatMessage: takeQueuedChatMessage({ set, get }),
  retryQueuedChatMessage: retryQueuedChatMessage({ set, get }),
  drainChatQueue: drainChatQueue({ set, get }),
  submitChatMessage: submitChatMessage({ set, get }),
});

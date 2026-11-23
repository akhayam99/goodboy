import type { SliceDeps } from '../../slice-types';
import { deliverToLead } from './deliverToLead';
import type { SentKeyParams } from './types';

export const retrySendToLead = ({ set, get }: SliceDeps) => {
  return async ({ key }: SentKeyParams): Promise<void> => {
    const entry = get().sentToLead[key];
    if (entry === undefined || entry.isNew) {
      return;
    }
    const { rootAgentId, sessionId } = entry.target;
    if (entry.phase === 'sent' && rootAgentId !== null) {
      await get().retryQueuedMessage({ sessionId, agentId: rootAgentId, itemId: entry.messageId });
      return;
    }
    if (entry.phase !== 'failed') {
      return;
    }
    await deliverToLead({ set, get, entry: { ...entry, messageId: crypto.randomUUID() } });
  };
};

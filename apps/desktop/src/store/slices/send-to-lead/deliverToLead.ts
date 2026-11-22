import { SEND_TO_LEAD_COPY } from '../../../features/work/sendToLead/sendToLeadCopy';
import type { SliceDeps } from '../../slice-types';
import { releaseSourceThread } from '../agentQueue/releaseSourceThread';
import { bindThread } from './bindThread';
import { isLeadStillOpen } from './isLeadStillOpen';
import type { SentToLead } from './state';
import { patchSentIfCurrent, writeSent } from './writeSent';

type DeliverParams = SliceDeps &
  Readonly<{
    entry: SentToLead;
  }>;

type Delivered = Pick<SentToLead, 'phase' | 'failure'>;

const SENT: Delivered = { phase: 'sent', failure: null };

const STOPPED: Delivered = { phase: 'stopped', failure: SEND_TO_LEAD_COPY.notDelivered };

const NOT_SAVED: Delivered = { phase: 'failed', failure: SEND_TO_LEAD_COPY.notSaved };

const deliver = async ({ set, get, entry }: DeliverParams): Promise<Delivered> => {
  const { treeId, rootAgentId, sessionId: leadSessionId } = entry.target;
  if (treeId === null || rootAgentId === null) {
    return STOPPED;
  }
  if (!(await isLeadStillOpen({ get, sessionId: entry.sessionId, treeId }))) {
    return STOPPED;
  }
  const bound =
    entry.threadId === null
      ? 'held'
      : await bindThread({
          set,
          get,
          sessionId: leadSessionId,
          agentId: rootAgentId,
          threadId: entry.threadId,
        });
  if (bound === 'refused') {
    return STOPPED;
  }
  const isSaved = await get().enqueueAgentMessage({
    turn: {
      id: entry.messageId,
      agentId: rootAgentId,
      content: entry.text,
      attachments: [],
      override: undefined,
      ...(entry.threadId !== null && { sourceThreadId: entry.threadId }),
    },
    shouldDropUnsaved: true,
  });
  if (!isSaved) {
    if (bound === 'bound' && entry.threadId !== null) {
      await releaseSourceThread({
        set,
        get,
        sessionId: leadSessionId,
        agentId: rootAgentId,
        threadId: entry.threadId,
      });
    }
    return NOT_SAVED;
  }
  void get().drainAgentQueue({ sessionId: leadSessionId, agentId: rootAgentId });
  return SENT;
};

export const deliverToLead = async ({ set, get, entry }: DeliverParams): Promise<void> => {
  writeSent({ set, entry: { ...entry, phase: 'sending', failure: null } });
  const outcome = await deliver({ set, get, entry }).catch((error: unknown): Delivered => ({
    phase: 'failed',
    failure: error instanceof Error ? error.message : SEND_TO_LEAD_COPY.notSaved,
  }));
  patchSentIfCurrent({ set, key: entry.key, messageId: entry.messageId, patch: outcome });
};

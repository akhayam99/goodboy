import type { SliceDeps } from '../../slice-types';
import { deliverToLead } from './deliverToLead';
import type { SendToLeadParams } from './types';

export const sendToLead = ({ set, get }: SliceDeps) => {
  return ({ candidate, ...item }: SendToLeadParams): Promise<void> =>
    deliverToLead({
      set,
      get,
      entry: {
        ...item,
        target: {
          treeId: candidate.treeId,
          rootAgentId: candidate.rootAgentId,
          sessionId: candidate.sessionId,
          title: candidate.title,
        },
        isNew: false,
        isCancelled: false,
        messageId: crypto.randomUUID(),
        phase: 'sending',
        failure: null,
      },
    });
};

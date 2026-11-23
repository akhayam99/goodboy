import type { SliceDeps } from '../../slice-types';
import { retrySendToLead } from './retrySendToLead';
import { sendToLead } from './sendToLead';
import { sendToLeadInitialState } from './state';
import type { SendToLeadSlice } from './types';
import { undoSendToLead } from './undoSendToLead';
import { dropSentIfCurrent, patchSentIfCurrent, writeSent } from './writeSent';

export const createSendToLeadSlice = ({ set, get }: SliceDeps): SendToLeadSlice => ({
  ...sendToLeadInitialState,
  sendToLead: sendToLead({ set, get }),
  undoSendToLead: undoSendToLead({ set, get }),
  retrySendToLead: retrySendToLead({ set, get }),
  recordSentToLead: ({ entry }) => writeSent({ set, entry }),
  patchSentToLead: ({ key, messageId, patch }) =>
    patchSentIfCurrent({ set, key, messageId, patch }),
  dismissSentToLead: ({ key }) => {
    const entry = get().sentToLead[key];
    if (entry !== undefined) {
      dropSentIfCurrent({ set, key, messageId: entry.messageId });
    }
  },
});

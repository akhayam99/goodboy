import type { BrowserTab } from '../../../../store/slices/browser/types';
import type { BrowserTabActionTarget } from '../../../actions/types';
import type { BrowserPaneModel } from '../../types';

type Params = {
  readonly model: BrowserPaneModel;
  readonly tab: BrowserTab;
};

const READING = 'Reading the page';

const NOTHING_TO_SEND = 'This tab has no web page to send';

const sendBlockedReasonOf = ({ model, tab }: Params): string | null => {
  if (model.pageSend.isBusy) {
    return READING;
  }
  return model.pageSend.canSendTab({ tab }) ? null : NOTHING_TO_SEND;
};

export const browserTabTargetOf = ({ model, tab }: Params): BrowserTabActionTarget => ({
  kind: 'browserTab',
  facts: {
    sendLabel: model.pageSend.isBusy ? READING : model.pageSend.label,
    sendBlockedReason: sendBlockedReasonOf({ model, tab }),
    onSend: () => model.pageSend.send({ tab }),
  },
});

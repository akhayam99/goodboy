import type { ShowToast } from '../../shared/components/Toast';
import { useAppStore } from '../../store';
import { openScriptOutput } from './openScriptOutput';
import { scriptEndNoticeOf } from './scriptEndNoticeOf';
import { scriptEndedDetailOf } from './scriptEndedDetailOf';

type Params = {
  readonly showToast: ShowToast;
};

export const scriptEndedListener =
  ({ showToast }: Params): EventListener =>
  (event) => {
    const detail = scriptEndedDetailOf({ event });
    if (detail === null) {
      return;
    }
    const notice = scriptEndNoticeOf({ state: useAppStore.getState(), detail });
    if (notice === null) {
      return;
    }
    showToast({
      kind: notice.kind,
      message: notice.message,
      dedupeKey: `script-ended:${detail.runId}`,
      action: {
        label: 'Open output',
        onClick: () =>
          openScriptOutput({
            sessionId: detail.sessionId,
            scriptKey: detail.scriptKey,
            mountId: notice.mountId,
          }),
      },
    });
  };

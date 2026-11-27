import type { Notification, NotificationAction } from '@goodboy/db';
import type { useAppStore } from '../../../../store';
import type { ToastAction } from '../../../../shared/components/Toast';
import {
  actionRetryOf,
  runActionRetry,
} from '../../../../store/slices/notifications/actionRetries';
import { CHECK_STATE } from '../../../../store/slices/notifications/errorRecovery';
import { NAMES } from '../../../../shared/utils/names';

type Params = {
  readonly action: Extract<NotificationAction, { kind: 'retry-action' }>;
  readonly store: ReturnType<typeof useAppStore.getState>;
  readonly notification: Notification;
};

export const mapRetryAction = ({
  action,
  store,
  notification,
}: Params): ToastAction | undefined => {
  const { retryId } = action;
  if (actionRetryOf({ retryId }) === undefined) {
    return undefined;
  }
  const { coalesceKey, id, sessionId } = notification;
  const settle = async (): Promise<void> => {
    if (coalesceKey == null) {
      await store.dismissNotification(id);
      return;
    }
    await store.resolveNotifications([coalesceKey]);
  };
  let isRetryDone = false;
  const run = async (): Promise<void> => {
    if (!isRetryDone) {
      isRetryDone = await runActionRetry({ retryId });
    }
    if (isRetryDone) {
      await settle();
    }
  };
  return {
    label: action.label ?? NAMES.retry,
    isKeptOpen: true,
    onClick: () => {
      void run().catch((error: unknown) => {
        void store.reportError({
          recovery: CHECK_STATE,
          title: "Couldn't finish the retry",
          error,
          ...(sessionId != null && { sessionId }),
        });
      });
    },
  };
};

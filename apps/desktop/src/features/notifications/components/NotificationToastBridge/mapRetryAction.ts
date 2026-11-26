import type { Notification, NotificationAction } from '@goodboy/db';
import type { useAppStore } from '../../../../store';
import type { ToastAction } from '../../../../shared/components/Toast';
import {
  actionRetryOf,
  runActionRetry,
} from '../../../../store/slices/notifications/actionRetries';
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
  const { coalesceKey } = notification;
  return {
    label: action.label ?? NAMES.retry,
    onClick: () => {
      void runActionRetry({ retryId }).then((isDone) => {
        if (!isDone || coalesceKey == null) {
          return;
        }
        void store.resolveNotifications([coalesceKey]);
      });
    },
  };
};

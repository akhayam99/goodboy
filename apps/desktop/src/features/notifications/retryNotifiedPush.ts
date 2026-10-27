import type { MountId, SessionId } from '@goodboy/types';
import type { useAppStore } from '../../store';
import {
  pushFailureKeyOf,
  pushFailureReportOf,
} from '../../store/slices/notifications/pushFailureReport';

type Params = {
  readonly store: ReturnType<typeof useAppStore.getState>;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

export const retryNotifiedPush = async ({ store, sessionId, mountId }: Params): Promise<void> => {
  const result = await store.pushBranch({ sessionId, mountId, mode: 'plain' });
  if (!result.ok) {
    await store.reportError({
      title: "Couldn't push the branch",
      error: result.error,
      ...pushFailureReportOf({ sessionId, mountId, isRetryable: true }),
    });
    return;
  }
  await store.resolveNotifications([pushFailureKeyOf({ mountId })]);
};

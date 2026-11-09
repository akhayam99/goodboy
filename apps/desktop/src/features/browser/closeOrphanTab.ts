import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { CHECK_STATE } from '../../store/slices/notifications/errorRecovery';
import { browserHost } from './browserHost';
import { isTabGone } from './isTabGone';

type Params = {
  readonly sessionId: SessionId;
  readonly liveId: string;
};

export const closeOrphanTab = async ({ sessionId, liveId }: Params): Promise<void> => {
  try {
    await browserHost.close({ tabId: liveId });
  } catch (error) {
    if (isTabGone({ error })) {
      return;
    }
    await useAppStore.getState().reportError({
      recovery: CHECK_STATE,
      title: "Couldn't close a browser tab",
      error,
      sessionId,
    });
  }
};

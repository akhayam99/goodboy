import { CHECK_STATE } from '../notifications/errorRecovery';
import { browserTabCommands } from './browserTabCommands';
import type { SliceDeps } from '../../slice-types';

export const closeStaleBrowserTabs = ({ get }: SliceDeps) => {
  return async (): Promise<void> => {
    let sessionIds: Awaited<ReturnType<typeof browserTabCommands.staleSessions>>;
    try {
      sessionIds = await browserTabCommands.staleSessions();
    } catch (error) {
      await get().reportError({
        recovery: CHECK_STATE,
        title: "Couldn't check the leftover browser tabs",
        error,
      });
      return;
    }
    if (!Array.isArray(sessionIds)) {
      return;
    }
    for (const sessionId of sessionIds) {
      await get().closeBrowserSessionTabs({ sessionId });
    }
  };
};

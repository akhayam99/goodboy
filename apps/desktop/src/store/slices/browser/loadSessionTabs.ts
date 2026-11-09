import { CHECK_STATE } from '../notifications/errorRecovery';
import { browserTabCommands } from './browserTabCommands';
import { browserWrites } from './browserWrites';
import type { SliceDeps } from '../../slice-types';
import type { SessionParams } from './types';

export const loadSessionTabs = ({ set, get }: SliceDeps) => {
  return async ({ sessionId }: SessionParams): Promise<void> => {
    const claimed = browserWrites.loads.claim({
      key: browserWrites.sessionLoadKey({ sessionId }),
    });
    try {
      const tabs = await browserTabCommands.list({ owner: { kind: 'session', sessionId } });
      if (!claimed.isCurrent()) {
        return;
      }
      set((state) => {
        const active = state.browserActiveTab[sessionId] ?? null;
        const isKept = active !== null && tabs.some((tab) => tab.id === active);
        return {
          browserSessionTabs: { ...state.browserSessionTabs, [sessionId]: tabs },
          browserActiveTab: {
            ...state.browserActiveTab,
            [sessionId]: isKept ? active : (tabs[0]?.id ?? null),
          },
        };
      });
    } catch (error) {
      if (!claimed.isCurrent()) {
        return;
      }
      await get().reportError({
        recovery: CHECK_STATE,
        title: "Couldn't load the browser tabs",
        error,
        sessionId,
      });
    }
  };
};

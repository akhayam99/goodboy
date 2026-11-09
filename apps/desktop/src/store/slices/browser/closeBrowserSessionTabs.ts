import { browserTabCommands } from './browserTabCommands';
import { browserWrite } from './browserWrite';
import { browserWrites } from './browserWrites';
import type { SliceDeps } from '../../slice-types';
import type { SessionParams } from './types';

export const closeBrowserSessionTabs = ({ set, get }: SliceDeps) => {
  return async ({ sessionId }: SessionParams): Promise<void> => {
    await browserWrite({
      get,
      failureTitle: "Couldn't close the browser tabs",
      target: { sessionId },
      step: async () => {
        const { failed } = await browserTabCommands.closeSession({ sessionId });
        if (failed.length > 0) {
          throw new Error(`${failed.length} browser tabs did not close`);
        }
        await browserTabCommands.removeSessionRows({ sessionId });
      },
      commit: () => {
        browserWrites.loads.cancel({ key: browserWrites.sessionLoadKey({ sessionId }) });
        set((state) => ({
          browserSessionTabs: { ...state.browserSessionTabs, [sessionId]: [] },
          browserActiveTab: { ...state.browserActiveTab, [sessionId]: null },
          browserShownPin: { ...state.browserShownPin, [sessionId]: null },
          browserLiveTabs: { ...state.browserLiveTabs, [sessionId]: {} },
        }));
      },
    });
  };
};

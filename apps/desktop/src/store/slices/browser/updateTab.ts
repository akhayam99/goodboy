import { browserTabCommands } from './browserTabCommands';
import { browserWrite } from './browserWrite';
import { browserWrites } from './browserWrites';
import type { SliceDeps } from '../../slice-types';
import type { BrowserTab, OpenTabParams } from './types';

export const updateTab = ({ set, get }: SliceDeps) => {
  return async ({ sessionId, tabId, url, title }: OpenTabParams): Promise<boolean> => {
    const isKnown = () =>
      (get().browserSessionTabs[sessionId] ?? []).some((tab) => tab.id === tabId);
    let wasSaved = false;
    await browserWrite<BrowserTab | null>({
      get,
      failureTitle: "Couldn't save the tab",
      target: { sessionId },
      step: async () => {
        if (!isKnown()) {
          return null;
        }
        return browserTabCommands.save({
          id: tabId,
          owner: { kind: 'session', sessionId },
          url,
          title,
        });
      },
      commit: ({ value: saved }) => {
        if (saved === null) {
          return;
        }
        wasSaved = true;
        browserWrites.loads.cancel({ key: browserWrites.sessionLoadKey({ sessionId }) });
        set((state) => ({
          browserSessionTabs: {
            ...state.browserSessionTabs,
            [sessionId]: (state.browserSessionTabs[sessionId] ?? []).map((tab) =>
              tab.id === saved.id ? saved : tab,
            ),
          },
        }));
      },
    });
    return wasSaved;
  };
};

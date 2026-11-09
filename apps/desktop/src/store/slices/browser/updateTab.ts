import { browserTabCommands } from './browserTabCommands';
import { browserWrite } from './browserWrite';
import { browserWrites } from './browserWrites';
import type { SliceDeps } from '../../slice-types';
import type { OpenTabParams } from './types';

export const updateTab = ({ set, get }: SliceDeps) => {
  return async ({ sessionId, tabId, url, title }: OpenTabParams): Promise<boolean> => {
    const isKnown = (get().browserSessionTabs[sessionId] ?? []).some((tab) => tab.id === tabId);
    if (!isKnown) {
      return false;
    }
    return browserWrite({
      get,
      failureTitle: "Couldn't save the tab",
      target: { sessionId },
      step: () =>
        browserTabCommands.save({ id: tabId, owner: { kind: 'session', sessionId }, url, title }),
      commit: ({ value: saved }) => {
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
  };
};

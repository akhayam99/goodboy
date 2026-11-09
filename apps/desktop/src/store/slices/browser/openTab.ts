import { browserTabCommands } from './browserTabCommands';
import { browserWrite } from './browserWrite';
import { browserWrites } from './browserWrites';
import { upsertTab } from './upsertTab';
import type { SliceDeps } from '../../slice-types';
import type { OpenTabParams } from './types';

export const openTab = ({ set, get }: SliceDeps) => {
  return ({ sessionId, tabId, url, title }: OpenTabParams): Promise<boolean> =>
    browserWrite({
      get,
      failureTitle: "Couldn't open the tab",
      target: { sessionId },
      step: () =>
        browserTabCommands.save({ id: tabId, owner: { kind: 'session', sessionId }, url, title }),
      commit: ({ value: tab }) => {
        browserWrites.loads.cancel({ key: browserWrites.sessionLoadKey({ sessionId }) });
        set((state) => ({
          browserSessionTabs: {
            ...state.browserSessionTabs,
            [sessionId]: upsertTab({ tabs: state.browserSessionTabs[sessionId] ?? [], tab }),
          },
          browserActiveTab: { ...state.browserActiveTab, [sessionId]: tab.id },
          browserShownPin: { ...state.browserShownPin, [sessionId]: null },
        }));
      },
    });
};

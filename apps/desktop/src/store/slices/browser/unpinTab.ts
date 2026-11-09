import { browserTabCommands } from './browserTabCommands';
import { browserWrite } from './browserWrite';
import { browserWrites } from './browserWrites';
import { projectReportTarget } from './projectReportTarget';
import { upsertTab } from './upsertTab';
import type { SliceDeps } from '../../slice-types';
import type { PinTabParams } from './types';

export const unpinTab = ({ set, get }: SliceDeps) => {
  return ({ sessionId, projectId, tabId }: PinTabParams): Promise<boolean> =>
    browserWrite({
      get,
      failureTitle: "Couldn't unpin the tab",
      target: { sessionId, ...projectReportTarget({ get, projectId }) },
      step: () => browserTabCommands.unpin({ id: tabId, sessionId, projectId }),
      commit: ({ value: tab }) => {
        browserWrites.loads.cancel({ key: browserWrites.sessionLoadKey({ sessionId }) });
        browserWrites.loads.cancel({ key: browserWrites.projectLoadKey({ projectId }) });
        set((state) => ({
          browserProjectPins: {
            ...state.browserProjectPins,
            [projectId]: (state.browserProjectPins[projectId] ?? []).filter(
              (pin) => pin.id !== tabId,
            ),
          },
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

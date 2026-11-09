import { browserTabCommands } from './browserTabCommands';
import { browserWrite } from './browserWrite';
import { browserWrites } from './browserWrites';
import { neighborAfterClose } from './neighborAfterClose';
import { upsertTab } from './upsertTab';
import type { SliceDeps } from '../../slice-types';
import type { PinTabParams } from './types';

export const pinTab = ({ set, get }: SliceDeps) => {
  return ({ sessionId, projectId, tabId }: PinTabParams): Promise<boolean> =>
    browserWrite({
      get,
      failureTitle: "Couldn't pin the tab",
      target: { sessionId },
      step: () => browserTabCommands.pin({ id: tabId, sessionId, projectId }),
      commit: ({ value: pin }) => {
        browserWrites.loads.cancel({ key: browserWrites.sessionLoadKey({ sessionId }) });
        browserWrites.loads.cancel({ key: browserWrites.projectLoadKey({ projectId }) });
        set((state) => {
          const tabs = state.browserSessionTabs[sessionId] ?? [];
          const wasActive = state.browserActiveTab[sessionId] === tabId;
          return {
            browserSessionTabs: {
              ...state.browserSessionTabs,
              [sessionId]: tabs.filter((tab) => tab.id !== tabId),
            },
            browserProjectPins: {
              ...state.browserProjectPins,
              [projectId]: upsertTab({ tabs: state.browserProjectPins[projectId] ?? [], tab: pin }),
            },
            browserActiveTab: wasActive
              ? { ...state.browserActiveTab, [sessionId]: neighborAfterClose({ tabs, tabId }) }
              : state.browserActiveTab,
            browserShownPin: wasActive
              ? { ...state.browserShownPin, [sessionId]: tabId }
              : state.browserShownPin,
          };
        });
      },
    });
};

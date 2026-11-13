import { browserTabCommands } from './browserTabCommands';
import { browserWrite } from './browserWrite';
import { browserWrites } from './browserWrites';
import { neighborAfterClose } from './neighborAfterClose';
import { pushClosedTab } from './pushClosedTab';
import { withoutDevicePreset } from './withoutDevicePreset';
import { withoutLiveTab } from './withoutLiveTab';
import type { SliceDeps } from '../../slice-types';
import type { SessionTabParams } from './types';

export const closeTab = ({ set, get }: SliceDeps) => {
  return ({ sessionId, tabId }: SessionTabParams): Promise<boolean> =>
    browserWrite({
      get,
      failureTitle: "Couldn't close the tab",
      target: { sessionId },
      step: () => browserTabCommands.remove({ owner: { kind: 'session', sessionId }, id: tabId }),
      commit: () => {
        browserWrites.loads.cancel({ key: browserWrites.sessionLoadKey({ sessionId }) });
        set((state) => {
          const tabs = state.browserSessionTabs[sessionId] ?? [];
          const wasActive = state.browserActiveTab[sessionId] === tabId;
          return {
            browserSessionTabs: {
              ...state.browserSessionTabs,
              [sessionId]: tabs.filter((tab) => tab.id !== tabId),
            },
            browserActiveTab: wasActive
              ? { ...state.browserActiveTab, [sessionId]: neighborAfterClose({ tabs, tabId }) }
              : state.browserActiveTab,
            browserLiveTabs: withoutLiveTab({ live: state.browserLiveTabs, sessionId, tabId }),
            browserDevicePresets: withoutDevicePreset({
              presets: state.browserDevicePresets,
              tabId,
            }),
            browserClosedTabs: {
              ...state.browserClosedTabs,
              [sessionId]: pushClosedTab({
                closed: state.browserClosedTabs[sessionId] ?? [],
                tab: tabs.find((tab) => tab.id === tabId),
              }),
            },
          };
        });
      },
    });
};

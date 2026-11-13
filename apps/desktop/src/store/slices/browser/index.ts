import { activateTab } from './activateTab';
import { bindLiveTab } from './bindLiveTab';
import { closeBrowserSessionTabs } from './closeBrowserSessionTabs';
import { closeStaleBrowserTabs } from './closeStaleBrowserTabs';
import { closeTab } from './closeTab';
import { endDraft } from './endDraft';
import { forgetClosedTab } from './forgetClosedTab';
import { loadProjectPins } from './loadProjectPins';
import { loadSessionTabs } from './loadSessionTabs';
import { openTab } from './openTab';
import { pinTab } from './pinTab';
import { reorderTabs } from './reorderTabs';
import { showPin } from './showPin';
import { unbindLiveTab } from './unbindLiveTab';
import { unpinTab } from './unpinTab';
import { updateTab } from './updateTab';
import type { SliceDeps } from '../../slice-types';

export const createBrowserSlice = ({ set, get }: SliceDeps) => {
  return {
    loadBrowserSessionTabs: loadSessionTabs({ set, get }),
    loadBrowserProjectPins: loadProjectPins({ set, get }),
    openBrowserTab: openTab({ set, get }),
    updateBrowserTab: updateTab({ set, get }),
    closeBrowserTab: closeTab({ set, get }),
    reorderBrowserTabs: reorderTabs({ set, get }),
    pinBrowserTab: pinTab({ set, get }),
    unpinBrowserTab: unpinTab({ set, get }),
    activateBrowserTab: activateTab({ set, get }),
    showBrowserPin: showPin({ set, get }),
    endBrowserDraft: endDraft({ set, get }),
    bindBrowserLiveTab: bindLiveTab({ set, get }),
    unbindBrowserLiveTab: unbindLiveTab({ set, get }),
    forgetClosedBrowserTab: forgetClosedTab({ set, get }),
    closeBrowserSessionTabs: closeBrowserSessionTabs({ set, get }),
    closeStaleBrowserTabs: closeStaleBrowserTabs({ set, get }),
  };
};

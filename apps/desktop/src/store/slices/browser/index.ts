import { activateTab } from './activateTab';
import { closeBrowserSessionTabs } from './closeBrowserSessionTabs';
import { closeTab } from './closeTab';
import { loadProjectPins } from './loadProjectPins';
import { loadSessionTabs } from './loadSessionTabs';
import { openTab } from './openTab';
import { pinTab } from './pinTab';
import { reorderTabs } from './reorderTabs';
import { unpinTab } from './unpinTab';
import type { SliceDeps } from '../../slice-types';

export const createBrowserSlice = ({ set, get }: SliceDeps) => {
  return {
    loadBrowserSessionTabs: loadSessionTabs({ set, get }),
    loadBrowserProjectPins: loadProjectPins({ set, get }),
    openBrowserTab: openTab({ set, get }),
    closeBrowserTab: closeTab({ set, get }),
    reorderBrowserTabs: reorderTabs({ set, get }),
    pinBrowserTab: pinTab({ set, get }),
    unpinBrowserTab: unpinTab({ set, get }),
    activateBrowserTab: activateTab({ set, get }),
    closeBrowserSessionTabs: closeBrowserSessionTabs({ set, get }),
  };
};

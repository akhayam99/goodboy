import { clearDrawer } from './clearDrawer';
import { closeDrawer } from './closeDrawer';
import { closeDrawerEntry } from './closeDrawerEntry';
import { focusDrawerPanel } from './focusDrawerPanel';
import { openDrawer } from './openDrawer';
import { recallDockGrid } from './recallDockGrid';
import { rememberDockGrid } from './rememberDockGrid';
import { resizeDockColumn } from './resizeDockColumn';
import { toggleDrawer } from './toggleDrawer';
import { turnDockPair } from './turnDockPair';
import type { SliceDeps } from '../../slice-types';

export const createDrawerSlice = ({ set, get }: SliceDeps) => {
  return {
    openDrawer: openDrawer(set),
    closeDrawer: closeDrawer(set),
    closeDrawerEntry: closeDrawerEntry({ set }),
    clearDrawer: clearDrawer({ set }),
    focusDrawerPanel: focusDrawerPanel({ set }),
    toggleDrawer: toggleDrawer(get),
    turnDockPair: turnDockPair({ set }),
    resizeDockColumn: resizeDockColumn({ set }),
    recallDockGrid: recallDockGrid({ set, get }),
    rememberDockGrid: rememberDockGrid({ get }),
  };
};

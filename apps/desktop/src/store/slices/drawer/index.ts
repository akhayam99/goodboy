import { announceDockFold } from './dockGridMemory/announceDockFold';
import { clearDrawer } from './clearDrawer';
import { closeDrawer } from './closeDrawer';
import { closeDrawerEntry } from './closeDrawerEntry';
import { focusDrawerPanel } from './focusDrawerPanel';
import { moveDockPanel } from './moveDockPanel';
import { resetDockGrid } from './dockGridMemory/resetDockGrid';
import { openDrawer } from './openDrawer';
import { recallDockGrid } from './dockGridMemory/recallDockGrid';
import { rememberDockGrid } from './dockGridMemory/rememberDockGrid';
import { resizeDockColumn } from './resizeDockColumn';
import { resizeDockRow } from './resizeDockRow';
import { toggleDrawer } from './toggleDrawer';
import { turnDockPair } from './turnDockPair';
import type { SliceDeps } from '../../slice-types';

export const createDrawerSlice = ({ set, get }: SliceDeps) => {
  return {
    openDrawer: openDrawer(set),
    announceDockFold: announceDockFold({ set, get }),
    closeDrawer: closeDrawer(set),
    closeDrawerEntry: closeDrawerEntry({ set }),
    clearDrawer: clearDrawer({ set }),
    focusDrawerPanel: focusDrawerPanel({ set }),
    toggleDrawer: toggleDrawer(get),
    turnDockPair: turnDockPair({ set }),
    resizeDockColumn: resizeDockColumn({ set }),
    resizeDockRow: resizeDockRow({ set }),
    moveDockPanel: moveDockPanel({ set, get }),
    resetDockGrid: resetDockGrid({ set, get }),
    recallDockGrid: recallDockGrid({ set, get }),
    rememberDockGrid: rememberDockGrid({ get }),
  };
};

import { clearDrawer } from './clearDrawer';
import { closeDrawer } from './closeDrawer';
import { closeDrawerEntry } from './closeDrawerEntry';
import { openDrawer } from './openDrawer';
import { toggleDrawer } from './toggleDrawer';
import type { SliceDeps } from '../../slice-types';

export const createDrawerSlice = ({ set, get }: SliceDeps) => {
  return {
    openDrawer: openDrawer(set),
    closeDrawer: closeDrawer(set),
    closeDrawerEntry: closeDrawerEntry({ set }),
    clearDrawer: clearDrawer({ set }),
    toggleDrawer: toggleDrawer(get),
  };
};

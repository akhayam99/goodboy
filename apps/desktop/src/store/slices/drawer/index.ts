import { closeDrawer } from './closeDrawer';
import { openDrawer } from './openDrawer';
import { toggleDrawer } from './toggleDrawer';
import type { SliceDeps } from '../../slice-types';

export const createDrawerSlice = ({ set, get }: SliceDeps) => {
  return {
    openDrawer: openDrawer(set),
    closeDrawer: closeDrawer(set),
    toggleDrawer: toggleDrawer(get),
  };
};

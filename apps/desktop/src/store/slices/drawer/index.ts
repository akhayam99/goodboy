import { closeDrawer } from './closeDrawer';
import { openDrawer } from './openDrawer';
import { toggleDrawer } from './toggleDrawer';
import type { GetFn, SetFn } from './types';

export const createDrawerSlice = (set: SetFn, get: GetFn) => {
  return {
    openDrawer: openDrawer(set),
    closeDrawer: closeDrawer(set),
    toggleDrawer: toggleDrawer(get),
  };
};

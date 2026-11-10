import { clearDrawer } from './clearDrawer';
import { closeDrawer } from './closeDrawer';
import { closeWorkspaceTools } from './closeWorkspaceTools';
import { openDrawer } from './openDrawer';
import { toggleDrawer } from './toggleDrawer';
import type { SliceDeps } from '../../slice-types';

export const createDrawerSlice = ({ set, get }: SliceDeps) => {
  return {
    openDrawer: openDrawer(set),
    closeDrawer: closeDrawer(set),
    clearDrawer: clearDrawer({ set }),
    closeWorkspaceTools: closeWorkspaceTools({ set }),
    toggleDrawer: toggleDrawer(get),
  };
};

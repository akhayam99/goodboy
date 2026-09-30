import { refreshUnreadWorkspaces } from './refreshUnreadWorkspaces';
import { setPanelSectionExpanded } from './setPanelSectionExpanded';
import type { SliceDeps } from '../../slice-types';

export const createSidebarSlice = ({ set, get }: SliceDeps) => {
  return {
    refreshUnreadWorkspaces: refreshUnreadWorkspaces(set),
    setPanelSectionExpanded: setPanelSectionExpanded(set, get),
  };
};

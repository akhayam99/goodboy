import { refreshUnreadWorkspaces } from './refreshUnreadWorkspaces';
import { refreshWorkspaceAttention } from './refreshWorkspaceAttention';
import { setWindowAttention } from './setWindowAttention';
import { setPanelSectionExpanded } from './setPanelSectionExpanded';
import type { SliceDeps } from '../../slice-types';

export const createSidebarSlice = ({ set, get }: SliceDeps) => {
  return {
    refreshUnreadWorkspaces: refreshUnreadWorkspaces(set),
    refreshWorkspaceAttention: refreshWorkspaceAttention({ set }),
    setWindowAttention: setWindowAttention({ set }),
    setPanelSectionExpanded: setPanelSectionExpanded(set, get),
  };
};

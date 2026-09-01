import { refreshUnreadWorkspaces } from './refreshUnreadWorkspaces';
import { setPanelSectionExpanded } from './setPanelSectionExpanded';
import type { GetFn, SetFn } from './types';

export const createSidebarSlice = (set: SetFn, get: GetFn) => {
  return {
    refreshUnreadWorkspaces: refreshUnreadWorkspaces(set),
    setPanelSectionExpanded: setPanelSectionExpanded(set, get),
  };
};

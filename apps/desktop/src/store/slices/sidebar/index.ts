import { refreshUnreadWorkspaces } from './refreshUnreadWorkspaces'
import { setPanelSectionExpanded } from './setPanelSectionExpanded'
import { setSidebarProviderFilter } from './setSidebarProviderFilter'
import { setSidebarSessionSearch } from './setSidebarSessionSearch'
import { setSidebarStateFilter } from './setSidebarStateFilter'
import { setSidebarWorkspaceSearch } from './setSidebarWorkspaceSearch'
import type { GetFn, SetFn } from './types'

export const createSidebarSlice = (set: SetFn, get: GetFn) => {
  return {
    setSidebarWorkspaceSearch: setSidebarWorkspaceSearch(set),
    setSidebarSessionSearch: setSidebarSessionSearch(set),
    refreshUnreadWorkspaces: refreshUnreadWorkspaces(set),
    setSidebarStateFilter: setSidebarStateFilter(set),
    setSidebarProviderFilter: setSidebarProviderFilter(set),
    setPanelSectionExpanded: setPanelSectionExpanded(set, get),
  }
}

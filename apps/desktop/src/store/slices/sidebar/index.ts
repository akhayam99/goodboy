import { refreshUnreadWorkspaces } from './refreshUnreadWorkspaces';
import { setSidebarProviderFilter } from './setSidebarProviderFilter';
import { setSidebarSessionSearch } from './setSidebarSessionSearch';
import { setSidebarStateFilter } from './setSidebarStateFilter';
import { setSidebarWorkspaceSearch } from './setSidebarWorkspaceSearch';
import type { GetFn, SetFn } from './types';

export function createSidebarSlice(set: SetFn, _get: GetFn) {
  return {
    setSidebarWorkspaceSearch: setSidebarWorkspaceSearch(set),
    setSidebarSessionSearch: setSidebarSessionSearch(set),
    refreshUnreadWorkspaces: refreshUnreadWorkspaces(set),
    setSidebarStateFilter: setSidebarStateFilter(set),
    setSidebarProviderFilter: setSidebarProviderFilter(set),
  };
}

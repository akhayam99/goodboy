import type { SetFn } from './types'

export const setSidebarWorkspaceSearch = (set: SetFn) => {
  return (query: string) => set({ sidebarWorkspaceSearch: query })
}

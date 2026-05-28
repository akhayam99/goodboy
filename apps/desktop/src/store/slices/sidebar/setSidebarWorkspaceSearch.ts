import type { SetFn } from './types';

export function setSidebarWorkspaceSearch(set: SetFn) {
  return (query: string) => set({ sidebarWorkspaceSearch: query });
}

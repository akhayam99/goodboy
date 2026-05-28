import type { SetFn } from './types';

export function setSidebarSessionSearch(set: SetFn) {
  return (query: string) => set({ sidebarSessionSearch: query });
}

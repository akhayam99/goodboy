import type { SetFn } from './types';

export const setSidebarSessionSearch = (set: SetFn) => {
  return (query: string) => set({ sidebarSessionSearch: query });
};

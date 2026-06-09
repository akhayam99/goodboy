import type { ProviderId } from '@goodboy/types';
import type { SetFn } from './types';

export const setSidebarProviderFilter = (set: SetFn) => {
  return (providers: ReadonlyArray<ProviderId>) => set({ sidebarProviderFilter: providers });
};

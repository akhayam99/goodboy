import type { DrawerRequest } from './state';
import type { SetFn } from './types';

export const openDrawer = (set: SetFn) => {
  return (request: DrawerRequest): void => {
    set((state) => ({
      drawer: { ...request, lens: state.activeLens[request.sessionId] ?? null },
    }));
  };
};

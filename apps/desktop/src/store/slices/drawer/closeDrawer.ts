import type { SetFn } from './types';

export const closeDrawer = (set: SetFn) => {
  return (): void => {
    set((state) => (state.drawer === null ? state : { drawer: null }));
  };
};

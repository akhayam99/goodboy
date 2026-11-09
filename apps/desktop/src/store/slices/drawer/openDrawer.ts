import { slotAfterOpen } from './slotAfterOpen';
import type { DrawerRequest } from './state';
import type { SetFn } from './types';

export const openDrawer = (set: SetFn) => {
  return (request: DrawerRequest): void => {
    set((state) =>
      slotAfterOpen({ drawer: state.drawer ?? null, back: state.drawerBack ?? null, request }),
    );
  };
};

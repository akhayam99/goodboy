import { deskStackOf } from './deskStackOf';
import { shownDeskStackOf } from './shownDeskStackOf';
import { slotAfterOpen } from './slotAfterOpen';
import { EMPTY_DRAWER_GRID, type DrawerRequest } from './state';
import type { SetFn } from './types';

export const openDrawer = (set: SetFn) => {
  return (request: DrawerRequest): void => {
    set((state) => {
      const next = slotAfterOpen({
        drawer: state.drawer ?? null,
        back: state.drawerBack ?? null,
        grid: state.drawerGrid ?? EMPTY_DRAWER_GRID,
        request,
      });
      const isPair = deskStackOf({ top: next.drawer, back: next.drawerBack }) !== null;
      const isHidden =
        isPair && shownDeskStackOf({ state: { ...next, sessionFace: state.sessionFace } }) === null;
      return isHidden ? { ...next, drawerBack: null } : next;
    });
  };
};

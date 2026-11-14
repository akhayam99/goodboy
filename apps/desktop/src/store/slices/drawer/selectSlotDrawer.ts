import type { AppState } from '../../types';
import { selectDetailDrawer } from './selectDetailDrawer';
import { selectDockDrawer } from './selectDockDrawer';
import { selectOpenDrawer } from './selectOpenDrawer';
import type { OpenDrawer } from './state';

export type DrawerSlot = 'top' | 'dock' | 'detail';

type Params = {
  readonly state: Pick<AppState, 'drawer' | 'drawerBack' | 'currentSessionId' | 'appStudio'>;
  readonly slot: DrawerSlot;
};

export const selectSlotDrawer = ({ state, slot }: Params): OpenDrawer | null => {
  if (slot === 'dock') {
    return selectDockDrawer({ state });
  }
  if (slot === 'detail') {
    return selectDetailDrawer({ state });
  }
  return selectOpenDrawer(state);
};

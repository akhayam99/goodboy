import type { DrawerSizing } from '@goodboy/ui';
import type { AppState } from '../../types';
import { DRAWER_KINDS } from './drawerKinds';
import { selectOpenDrawer } from './selectOpenDrawer';

export const selectDrawerSizing = (
  state: Pick<AppState, 'drawer' | 'currentSessionId'>,
): DrawerSizing => {
  const drawer = selectOpenDrawer(state);
  if (drawer === null) {
    return 'side';
  }
  return DRAWER_KINDS[drawer.kind].sizing;
};

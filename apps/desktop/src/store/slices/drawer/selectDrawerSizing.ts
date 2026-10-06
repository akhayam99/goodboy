import type { DrawerSizing } from '@goodboy/ui';
import type { AppState } from '../../types';
import { selectOpenDrawer } from './selectOpenDrawer';

export const selectDrawerSizing = (state: AppState): DrawerSizing => {
  const drawer = selectOpenDrawer(state);
  if (drawer === null) {
    return 'default';
  }
  if (drawer.kind !== 'artifact-document') {
    return 'default';
  }
  return state.documentDrawerExpanded?.[drawer.sessionId] === true ? 'full' : 'half';
};

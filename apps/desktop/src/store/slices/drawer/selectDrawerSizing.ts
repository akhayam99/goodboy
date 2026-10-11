import type { DrawerSizing } from '@goodboy/ui';
import type { AppState } from '../../types';
import { selectOpenDrawer } from './selectOpenDrawer';

export const selectDrawerSizing = (
  state: Pick<AppState, 'drawer' | 'currentSessionId' | 'documentDrawerExpanded'>,
): DrawerSizing => {
  const drawer = selectOpenDrawer(state);
  if (drawer === null) {
    return 'side';
  }
  if (drawer.kind === 'explore-file' || drawer.kind === 'file-diff') {
    return 'reader';
  }
  if (drawer.kind !== 'artifact-document') {
    return 'side';
  }
  return state.documentDrawerExpanded?.[drawer.sessionId] === true ? 'full' : 'reader';
};
